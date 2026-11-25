"use server";

import { getPoolContext } from "@/lib/pool-context";
import { allRows } from "@/lib/supabase/all-rows";

import { canShowMatchupPicks, type MatchupPicks } from "./matchup-picks";

export async function loadMatchupPicks(
  gameId: number,
): Promise<MatchupPicks | null> {
  if (!Number.isSafeInteger(gameId) || gameId < 1) return null;
  const { supabase, entry } = await getPoolContext();
  if (!entry) return null;

  const { data: game, error } = await supabase
    .from("games")
    .select(
      "week_id,kickoff_at,status,away_team,home_team,pool_lines(away_spread,total),pool_weeks!inner(season_id,published_at)",
    )
    .eq("id", gameId)
    .eq("pool_weeks.season_id", entry.season_id)
    .not("pool_weeks.published_at", "is", null)
    .maybeSingle();
  if (error) throw error;
  if (!game || !canShowMatchupPicks(game.status, game.kickoff_at, Date.now()))
    return null;

  const [{ data: submissions }, { data: teams, error: teamsError }] =
    await Promise.all([
      allRows(() =>
        supabase
          .from("weekly_submissions")
          .select(
            "id,entry_id,pool_entries!inner(entry_code),picks(kind,team,total_direction,is_best_bet)",
          )
          .eq("week_id", game.week_id)
          .eq("pool_entries.season_id", entry.season_id)
          .eq("picks.game_id", gameId)
          .order("revision", { ascending: false })
          .order("id"),
      ),
      supabase
        .from("teams")
        .select("abbreviation,logo_url")
        .in("abbreviation", [game.away_team, game.home_team]),
    ]);
  if (teamsError) throw teamsError;
  const logos = new Map(
    teams?.map((team) => [team.abbreviation, team.logo_url]),
  );
  const line = Array.isArray(game.pool_lines)
    ? game.pool_lines[0]
    : game.pool_lines;
  const result: MatchupPicks = {
    away: { team: game.away_team, logo: logos.get(game.away_team), picks: [] },
    home: { team: game.home_team, logo: logos.get(game.home_team), picks: [] },
    awaySpread: line?.away_spread == null ? null : Number(line.away_spread),
    total: line?.total == null ? null : Number(line.total),
    over: [],
    under: [],
  };
  const seen = new Set<number>();
  for (const submission of submissions) {
    if (seen.has(submission.entry_id)) continue;
    seen.add(submission.entry_id);
    const entrant = Array.isArray(submission.pool_entries)
      ? submission.pool_entries[0]
      : submission.pool_entries;
    if (!entrant) continue;
    const code = entrant.entry_code as string;
    const awayMarks = new Set<string>();
    const homeMarks = new Set<string>();
    for (const pick of submission.picks) {
      if (pick.kind === "total") {
        if (pick.total_direction === "over") result.over.push(code);
        if (pick.total_direction === "under") result.under.push(code);
        continue;
      }
      const marks =
        pick.team === result.away.team
          ? awayMarks
          : pick.team === result.home.team
            ? homeMarks
            : null;
      if (!marks) continue;
      marks.add(
        pick.kind === "sudden_death"
          ? " (SD)"
          : pick.kind === "underdog"
            ? " (UD)"
            : pick.is_best_bet
              ? " (BB)"
              : "",
      );
    }
    for (const [side, marks] of [
      [result.away, awayMarks],
      [result.home, homeMarks],
    ] as const) {
      if (marks.size)
        side.picks.push(
          code +
            [" (BB)", " (UD)", " (SD)"]
              .filter((mark) => marks.has(mark))
              .join(""),
        );
    }
  }
  for (const column of [
    result.away.picks,
    result.home.picks,
    result.over,
    result.under,
  ]) {
    column.sort((a, b) => a.localeCompare(b));
  }
  return result;
}
