import type { SupabaseClient } from "@supabase/supabase-js";

import {
  calculateStandings,
  gamesBack,
  rankStandings,
  sharedRankPayout,
  sidePoolPayout,
  type ScoringGame,
  type ScoringPick,
} from "./scoring";

export async function loadCompetition(
  supabase: SupabaseClient,
  seasonId: number,
  throughWeekNumber?: number,
  options: {
    includeComments?: boolean;
    includePayouts?: boolean;
    includeTeams?: boolean;
    onlyWeekNumber?: number;
  } = {},
) {
  const {
    includeComments = true,
    includePayouts = true,
    includeTeams = true,
    onlyWeekNumber,
  } = options;
  const [
    { data: entries },
    { data: weeks },
    { data: payoutRows },
    { data: teams },
  ] = await Promise.all([
    supabase
      .from("pool_entries")
      .select("id, entry_code, user_id")
      .eq("season_id", seasonId)
      .order("entry_code"),
    (() => {
      let query = supabase
        .from("pool_weeks")
        .select("id, week_number, label")
        .eq("season_id", seasonId)
        .not("published_at", "is", null);
      if (onlyWeekNumber !== undefined)
        query = query.eq("week_number", onlyWeekNumber);
      else if (throughWeekNumber !== undefined)
        query = query.lte("week_number", throughWeekNumber);
      return query.order("week_number");
    })(),
    includePayouts
      ? supabase
          .from("payout_schedules")
          .select("rank, amount, locked_at")
          .eq("season_id", seasonId)
          .order("rank")
      : Promise.resolve({ data: [] }),
    includeTeams
      ? supabase.from("teams").select("abbreviation, logo_url")
      : Promise.resolve({ data: [] }),
  ]);
  const weekIds = (weeks ?? []).map((week) => week.id);
  const [{ data: gameRows }, { data: submissionRows }, { data: comments }] =
    weekIds.length
      ? await Promise.all([
          supabase
            .from("games")
            .select(
              "id, week_id, away_team, home_team, kickoff_at, status, away_score, home_score, pool_lines(away_spread,total)",
            )
            .in("week_id", weekIds)
            .order("kickoff_at"),
          supabase
            .from("weekly_submissions")
            .select("id, entry_id, week_id, revision, submitted_at")
            .in("week_id", weekIds)
            .order("revision", { ascending: false }),
          includeComments
            ? supabase
                .from("weekly_comments")
                .select("entry_id, week_id, body, updated_at")
                .in("week_id", weekIds)
            : Promise.resolve({ data: [] }),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];
  type SubmissionRow = {
    id: number;
    entry_id: number;
    week_id: number;
    revision: number;
    submitted_at: string;
  };
  const latest = new Map<string, SubmissionRow>();
  for (const submission of submissionRows ?? []) {
    const key = `${submission.entry_id}:${submission.week_id}`;
    if (!latest.has(key)) latest.set(key, submission);
  }
  const latestIds = [...latest.values()].map((submission) => submission.id);
  const { data: pickRows } = latestIds.length
    ? await supabase
        .from("picks")
        .select(
          "id, submission_id, game_id, kind, team, total_direction, is_best_bet",
        )
        .in("submission_id", latestIds)
    : { data: [] };
  const weekMap = new Map((weeks ?? []).map((week) => [week.id, week]));
  const games: ScoringGame[] = (gameRows ?? []).map((row) => {
    const line = Array.isArray(row.pool_lines)
      ? row.pool_lines[0]
      : row.pool_lines;
    return {
      id: row.id,
      weekId: row.week_id,
      weekNumber: weekMap.get(row.week_id)?.week_number ?? 0,
      away: row.away_team,
      home: row.home_team,
      awaySpread: Number(line?.away_spread ?? 0),
      total: Number(line?.total ?? 0),
      awayScore: row.away_score,
      homeScore: row.home_score,
      status: row.status,
    };
  });
  const entryBySubmission = new Map(
    [...latest.values()].map((submission) => [
      submission.id,
      submission.entry_id,
    ]),
  );
  const picks: ScoringPick[] = (pickRows ?? []).flatMap((row) => {
    const entryId = entryBySubmission.get(row.submission_id);
    return entryId
      ? [
          {
            entryId,
            gameId: row.game_id,
            kind: row.kind as ScoringPick["kind"],
            team: row.team,
            totalDirection:
              row.total_direction as ScoringPick["totalDirection"],
            isBestBet: row.is_best_bet,
          },
        ]
      : [];
  });
  const standings = rankStandings(
    calculateStandings(
      (entries ?? []).map((item) => item.id),
      games,
      picks,
    ),
  );
  const schedule = new Map(
    (payoutRows ?? []).map((row) => [row.rank, Number(row.amount)]),
  );
  const mainPayout = new Map<number, number>();
  for (let index = 0; index < standings.length;) {
    const gb = gamesBack(standings[index], standings);
    let count = 1;
    while (
      index + count < standings.length &&
      gamesBack(standings[index + count], standings) === gb
    )
      count += 1;
    const amount = sharedRankPayout(index + 1, count, schedule);
    for (let offset = 0; offset < count; offset++)
      mainPayout.set(standings[index + offset].entryId, amount);
    index += count;
  }
  const sdWinners = standings.filter((item) => !item.eliminated);
  const maxUd = Math.max(0, ...standings.map((item) => item.underdogPoints));
  const udWinners = standings.filter((item) => item.underdogPoints === maxUd);
  const allEntryIds = standings.map((item) => item.entryId);
  const sdWinnerIds = sdWinners.map((item) => item.entryId);
  const udWinnerIds = udWinners.map((item) => item.entryId);
  const financials = new Map(
    standings.map((standing) => [
      standing.entryId,
      {
        main: mainPayout.get(standing.entryId) ?? 0,
        sd: sidePoolPayout(standing.entryId, allEntryIds, sdWinnerIds),
        ud: sidePoolPayout(standing.entryId, allEntryIds, udWinnerIds),
        net:
          (mainPayout.get(standing.entryId) ?? 0) +
          sidePoolPayout(standing.entryId, allEntryIds, sdWinnerIds) +
          sidePoolPayout(standing.entryId, allEntryIds, udWinnerIds),
      },
    ]),
  );
  return {
    entries: entries ?? [],
    weeks: weeks ?? [],
    games,
    picks,
    standings,
    financials,
    submissions: submissionRows ?? [],
    latest,
    comments: comments ?? [],
    teams: teams ?? [],
    payoutRows: payoutRows ?? [],
  };
}
