import {
  GridNavigation,
  GridNavigationTitle,
} from "@/components/grid-navigation";
import { CompactPageHeader } from "@/components/compact-page-header";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { GridPreviewTable, StickyGridTable } from "@/components/grid-table";
import { PageShell } from "@/components/page-shell";
import { WeekSelector } from "@/components/week-selector";
import { TableTeam } from "@/components/table-team";
import { loadCompetition } from "@/features/competition/data";
import { allRows } from "@/lib/supabase/all-rows";
import { gridSlots, type PickCounts } from "@/features/competition/grid-slots";
import {
  compareRecords,
  winningPercentage,
  pickOutcome,
  recordForPicks,
  type ScoringGame,
  type ScoringPick,
} from "@/features/competition/scoring";
import { resultVisualClass } from "@/features/competition/result-style";
import { getPoolContext } from "@/lib/pool-context";
import { selectPoolWeek } from "@/lib/pool-weeks";

export const dynamic = "force-dynamic";

type GridPick = ScoringPick & { submissionId: number; kickoff: string };

function TeamMark({
  team,
  logo,
  spread,
}: {
  team: string;
  logo?: string | null;
  spread?: number;
}) {
  return (
    <span
      title={team}
      aria-label={team}
      className="mx-auto grid h-9 place-items-center text-[11px] font-black leading-none"
    >
      <TableTeam team={team} src={logo} />
      {spread !== undefined && (
        <small className="-mt-1 text-[11px] font-black">
          {spread > 0 ? "+" : ""}
          {spread}
        </small>
      )}
    </span>
  );
}

function resultTone(game: ScoringGame | undefined, pick: ScoringPick) {
  if (!game) return "";
  if (game.status === "live")
    return `${resultVisualClass("live", livePickOutcome(game, pick))} ring-1 ring-inset ring-amber-400`;
  return resultVisualClass("final", pickOutcome(game, pick));
}

function livePickOutcome(game: ScoringGame, pick: ScoringPick) {
  if (game.awayScore === null || game.homeScore === null) return "pending";
  if (pick.kind === "total") {
    const scored = game.awayScore + game.homeScore;
    if (scored === game.total) return "tie";
    return scored > game.total === (pick.totalDirection === "over")
      ? "win"
      : "loss";
  }
  const away = game.awayScore + (pick.kind === "ats" ? game.awaySpread : 0);
  const home = game.homeScore;
  const picked = pick.team === game.away ? away : home;
  const opponent = pick.team === game.away ? home : away;
  if (picked === opponent) return "tie";
  return picked > opponent ? "win" : "loss";
}

function outcomeTextTone(outcome: string) {
  return outcome === "win"
    ? "text-emerald-400"
    : outcome === "loss"
      ? "text-red-400"
      : outcome === "tie"
        ? "text-slate-300"
        : outcome === "live"
          ? "text-amber-300"
          : "";
}

function ranked(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .sort(([leftName, left], [rightName, right]) =>
      right === left ? leftName.localeCompare(rightName) : right - left,
    )
    .slice(0, 5);
}

export default async function GridPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { supabase, entry, isCommissioner } = await getPoolContext();
  const { data: weeks } = entry
    ? await supabase
        .from("pool_weeks")
        .select("id, label, week_number, lines_freeze_at")
        .eq("season_id", entry.season_id)
        .not("published_at", "is", null)
        .order("week_number")
    : { data: [] };
  const requestedWeek = Number((await searchParams).week);
  const week = selectPoolWeek(weeks ?? [], requestedWeek);
  const [
    { data: gameRows },
    { data: entries },
    { data: submissions },
    { data: teams },
    { data: comments },
  ] =
    week && entry
      ? await Promise.all([
          supabase
            .from("games")
            .select(
              "id, away_team, home_team, kickoff_at, status, away_score, home_score, pool_lines(away_spread,total)",
            )
            .eq("week_id", week.id)
            .order("kickoff_at"),
          supabase
            .from("pool_entries")
            .select("id, entry_code")
            .eq("season_id", entry.season_id)
            .order("entry_code"),
          allRows(() =>
            supabase
              .from("weekly_submissions")
              .select("id, entry_id, revision")
              .eq("week_id", week.id)
              .order("revision", { ascending: false })
              .order("id"),
          ),
          supabase.from("teams").select("abbreviation, logo_url"),
          supabase
            .from("weekly_comments")
            .select("entry_id, body")
            .eq("week_id", week.id),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const games: ScoringGame[] = (gameRows ?? []).map((row) => {
    const line = Array.isArray(row.pool_lines)
      ? row.pool_lines[0]
      : row.pool_lines;
    return {
      id: row.id,
      weekId: week!.id,
      weekNumber: week!.week_number,
      away: row.away_team,
      home: row.home_team,
      awaySpread: Number(line?.away_spread ?? 0),
      total: Number(line?.total ?? 0),
      awayScore: row.away_score,
      homeScore: row.home_score,
      status: row.status,
    };
  });
  const gameMap = new Map(games.map((game) => [game.id, game]));
  const kickoffMap = new Map(
    (gameRows ?? []).map((game) => [game.id, game.kickoff_at]),
  );
  const logoMap = new Map(
    (teams ?? []).map((team) => [team.abbreviation, team.logo_url]),
  );
  const commentMap = new Map(
    (comments ?? []).map((comment) => [comment.entry_id, comment.body]),
  );
  const latest = new Map<number, number>();
  for (const submission of submissions ?? [])
    if (!latest.has(submission.entry_id))
      latest.set(submission.entry_id, submission.id);
  const submissionIds = [...latest.values()];
  const { data: pickRows } = submissionIds.length
    ? await allRows(() =>
        supabase
          .from("picks")
          .select(
            "id, submission_id, game_id, kind, team, total_direction, is_best_bet, sd_contest_id",
          )
          .in("submission_id", submissionIds)
          .order("id"),
      )
    : { data: [] };
  const [countsResult, priorCompetition] = await Promise.all([
    week
      ? supabase.rpc("week_pick_counts", { target_week_id: week.id })
      : Promise.resolve({ data: [], error: null }),
    week && entry
      ? loadCompetition(supabase, entry.season_id, week.week_number - 1, {
          includeComments: false,
          includePayouts: false,
          includeTeams: false,
        })
      : Promise.resolve(null),
  ]);
  // Older deployments can omit occupancy hints until the migration is applied.
  // Never invent placeholders or expose hidden selections on a count-query error.
  if (countsResult.error)
    console.error("Grid occupancy unavailable", countsResult.error.code);
  const countsByEntry = new Map<number, PickCounts>(
    ((countsResult.data ?? []) as (PickCounts & { entry_id: number })[]).map(
      (row) => [row.entry_id, row],
    ),
  );
  const activeContest = priorCompetition?.sdContests.find(
    (c) =>
      week &&
      week.week_number >= c.start_week &&
      week.week_number <= c.end_week,
  );
  const sdLabel = activeContest ? `SD${activeContest.number}` : "SD1";
  const eliminatedEntries = new Set(
    (activeContest?.standings ?? priorCompetition?.standings)
      ?.filter((s) => s.eliminated || Boolean(activeContest?.completedWeek))
      .map((s) => s.entryId) ?? [],
  );
  const entryBySubmission = new Map(
    [...latest].map(([entryId, submissionId]) => [submissionId, entryId]),
  );
  // Grid visibility changes at request time as games kick off.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const authorizedPicks: GridPick[] = (pickRows ?? []).flatMap((pick) => {
    const entryId = entryBySubmission.get(pick.submission_id);
    const kickoff = kickoffMap.get(pick.game_id);
    if (
      !entryId ||
      !kickoff ||
      (pick.kind === "sudden_death" &&
        (eliminatedEntries.has(entryId) ||
          (activeContest && pick.sd_contest_id !== activeContest.id)))
    )
      return [];
    return [
      {
        entryId,
        submissionId: pick.submission_id,
        gameId: pick.game_id,
        kind: pick.kind as GridPick["kind"],
        team: pick.team,
        totalDirection: pick.total_direction as GridPick["totalDirection"],
        isBestBet: pick.is_best_bet,
        kickoff,
      },
    ];
  });
  const visiblePicks = authorizedPicks.filter(
    (pick) =>
      pick.entryId === entry?.id || new Date(pick.kickoff).getTime() <= now,
  );
  const consensusPicks = authorizedPicks.filter(
    (pick) => new Date(pick.kickoff).getTime() <= now,
  );
  const most = {
    ats: ranked(
      consensusPicks
        .filter((pick) => pick.kind === "ats")
        .map((pick) => pick.team!),
    ),
    totals: ranked(
      consensusPicks
        .filter((pick) => pick.kind === "total")
        .map(
          (pick) =>
            `${gameMap.get(pick.gameId)?.away}/${gameMap.get(pick.gameId)?.home} ${pick.totalDirection === "over" ? "O" : "U"}`,
        ),
    ),
    ud: ranked(
      consensusPicks
        .filter((pick) => pick.kind === "underdog")
        .map((pick) => {
          const game = gameMap.get(pick.gameId);
          const spread =
            pick.team === game?.away
              ? game.awaySpread
              : -(game?.awaySpread ?? 0);
          return `${pick.team} ${spread > 0 ? "+" : ""}${spread}`;
        }),
    ),
    sd: ranked(
      consensusPicks
        .filter((pick) => pick.kind === "sudden_death")
        .map((pick) => pick.team!),
    ),
  };
  const mostPickedOutcome = (label: string, name: string) => {
    const matching = consensusPicks.find((pick) => {
      if (label === "MAIN") return pick.kind === "ats" && pick.team === name;
      if (label === "UD")
        return pick.kind === "underdog" && pick.team === name.split(" ", 1)[0];
      if (label === sdLabel)
        return pick.kind === "sudden_death" && pick.team === name;
      const game = gameMap.get(pick.gameId);
      return (
        pick.kind === "total" &&
        `${game?.away}/${game?.home} ${pick.totalDirection === "over" ? "O" : "U"}` ===
          name
      );
    });
    if (!matching) return "pending";
    const game = gameMap.get(matching.gameId);
    return game?.status === "live"
      ? "live"
      : game
        ? pickOutcome(game, matching)
        : "pending";
  };
  const weeklyRows = (entries ?? [])
    .map((poolEntry) => {
      const picks = visiblePicks.filter(
        (pick) => pick.entryId === poolEntry.id,
      );
      return {
        poolEntry,
        overall: recordForPicks(games, picks, ["ats", "total"], true),
        ats: recordForPicks(games, picks, ["ats"], true),
        totals: recordForPicks(games, picks, ["total"]),
      };
    })
    .sort(
      (a, b) =>
        compareRecords(a.overall, b.overall) ||
        a.poolEntry.entry_code.localeCompare(b.poolEntry.entry_code),
    );
  const weeklyRanks = new Map<number, number>();
  weeklyRows.forEach((row, index) => {
    const prior = index > 0 ? weeklyRows[index - 1] : undefined;
    weeklyRanks.set(
      row.poolEntry.id,
      prior &&
        row.overall.wins - row.overall.losses ===
          prior.overall.wins - prior.overall.losses
        ? weeklyRanks.get(prior.poolEntry.id)!
        : index + 1,
    );
  });
  const poolRecord = recordForPicks(
    games,
    consensusPicks,
    ["ats", "total"],
    true,
  );
  const poolWinRate = winningPercentage(poolRecord);
  const poolWinPercent =
    poolWinRate === "—" ? "—" : `${(Number(poolWinRate) * 100).toFixed(1)}%`;
  const gridCellsFor = (entryId: number) => {
    const picks = visiblePicks
      .filter((pick) => pick.entryId === entryId)
      .sort(
        (a, b) => a.kickoff.localeCompare(b.kickoff) || a.gameId - b.gameId,
      );
    const counts = countsByEntry.get(entryId);
    return gridSlots(
      picks,
      counts && eliminatedEntries.has(entryId)
        ? { ...counts, has_sudden_death: false }
        : counts,
    );
  };
  const gridRow = (poolEntry: { id: number; entry_code: string }) => (
    <tr
      key={poolEntry.id}
      className={poolEntry.id === entry?.id ? "own-entry" : ""}
    >
      <th className="sticky left-0 z-10 w-[60px] min-w-[60px] max-w-[60px] border-b border-r border-slate-800 bg-[#111417] px-2 py-1.5 text-left font-black">
        {poolEntry.entry_code}
      </th>
      {gridCellsFor(poolEntry.id).map((slot, index) => {
        const pick = slot && slot !== "hidden" ? slot : null;
        return (
          <td
            key={index}
            className={`h-10 min-w-10 border-b border-r border-slate-800 px-0.5 text-center ${pick ? resultTone(gameMap.get(pick.gameId), pick) : ""}`}
          >
            {pick ? (
              pick.kind === "total" ? (
                <span
                  title={`${gameMap.get(pick.gameId)?.away} at ${gameMap.get(pick.gameId)?.home}`}
                  className="text-xs font-black"
                >
                  {gameMap.get(pick.gameId)?.away}/
                  {gameMap.get(pick.gameId)?.home}
                  <br />
                  <b>{pick.totalDirection === "over" ? "OVER" : "UNDER"}</b>
                </span>
              ) : (
                <TeamMark
                  team={pick.team!}
                  logo={logoMap.get(pick.team!)}
                  spread={
                    pick.kind === "underdog"
                      ? pick.team === gameMap.get(pick.gameId)?.away
                        ? gameMap.get(pick.gameId)?.awaySpread
                        : -(gameMap.get(pick.gameId)?.awaySpread ?? 0)
                      : undefined
                  }
                />
              )
            ) : slot === "hidden" ? (
              <span
                aria-label="Submitted, unrevealed"
                className="text-slate-300"
              >
                —
              </span>
            ) : null}
          </td>
        );
      })}
      <td className="max-w-52 border-b border-slate-800 px-3 py-2 text-xs leading-4 text-slate-300">
        {commentMap.get(poolEntry.id) ?? "—"}
      </td>
    </tr>
  );
  const ownEntry = (entries ?? []).find(
    (poolEntry) => poolEntry.id === entry?.id,
  );
  const ownWeeklyRow = weeklyRows.find((row) => row.poolEntry.id === entry?.id);
  const mostGroups = [
    ["MAIN", most.ats],
    ["O/U", most.totals],
    ["UD", most.ud],
    [sdLabel, most.sd],
  ] as const;
  const mostPickedItem = (
    label: (typeof mostGroups)[number][0],
    name: string,
    count: number,
  ) => (
    <span
      className={`block truncate text-xs font-black ${outcomeTextTone(mostPickedOutcome(label, name))}`}
    >
      {count} {name}
      {label === "MAIN" &&
        ` (${consensusPicks.filter((pick) => pick.kind === "ats" && pick.team === name && pick.isBestBet).length} BB)`}
    </span>
  );
  const weeklyTable = (rows: typeof weeklyRows) => (
    <div className="overflow-x-auto border-t border-slate-800">
      <table className="pool-table w-full min-w-[390px]">
        <thead className="bg-slate-950 text-slate-300">
          <tr>
            {["RK", "TM", "OVR", "ATS", "O/U"].map((header) => (
              <th key={header} className="px-2 py-2 text-left">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ poolEntry, overall, ats, totals }) => {
            const show = (record: typeof overall) =>
              `${record.wins}-${record.losses}-${record.ties}`;
            return (
              <tr
                key={poolEntry.id}
                className={poolEntry.id === entry?.id ? "own-entry" : ""}
              >
                <td className="rank-cell border-t border-slate-800 px-2 py-2">
                  {weeklyRanks.get(poolEntry.id)}
                </td>
                <th className="border-t border-slate-800 px-2 py-2 text-left">
                  {poolEntry.entry_code}
                </th>
                <td className="border-t border-slate-800 px-2 py-2">
                  {show(overall)}
                </td>
                <td className="border-t border-slate-800 px-2 py-2">
                  {show(ats)}
                </td>
                <td className="border-t border-slate-800 px-2 py-2">
                  {show(totals)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <PageShell
      entryCode={entry?.entry_code}
      isCommissioner={isCommissioner}
      compact
      refreshWhileLive={games.some((game) => game.status === "live")}
    >
      <GridNavigation>
        <div className="pb-3 sm:pb-5">
          <CompactPageHeader
            sticky
            title={<GridNavigationTitle />}
            className="mb-3"
            action={
              week ? (
                <WeekSelector weeks={weeks ?? []} selected={week.week_number} />
              ) : undefined
            }
          />
          <CollapsiblePanel
            title="Weekly grid"
            summary={`MAIN ${poolRecord.wins}-${poolRecord.losses}-${poolRecord.ties} (${poolWinPercent})`}
            defaultOpen
            className="shadow-xl"
            preview={
              ownEntry ? (
                <GridPreviewTable sdLabel={sdLabel}>
                  {gridRow(ownEntry)}
                </GridPreviewTable>
              ) : undefined
            }
          >
            <StickyGridTable sdLabel={sdLabel}>
              {(entries ?? []).map(gridRow)}
            </StickyGridTable>
            <div className="flex flex-wrap gap-4 border-t border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-300">
              <span className="text-emerald-400">Win</span>
              <span className="text-red-400">Loss</span>
              <span className="text-slate-300">Tie</span>
              <span className="text-amber-300">Live</span>
              <span>— = submitted, unrevealed · Blank = no pick</span>
            </div>
          </CollapsiblePanel>
          <CollapsiblePanel
            title="Most Picked"
            className="mt-4"
            preview={
              <div className="grid grid-cols-4 gap-px border-t border-slate-800 bg-slate-800">
                {mostGroups.map(([label, items]) => (
                  <div key={label} className="min-w-0 bg-slate-950 px-2 py-2.5">
                    <small className="block text-[11px] font-black text-slate-300">
                      {label}
                    </small>
                    {items[0] ? (
                      mostPickedItem(label, items[0][0], items[0][1])
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </div>
                ))}
              </div>
            }
          >
            <section
              className="grid grid-cols-4 gap-px border-t border-slate-800 bg-slate-800"
              aria-label="Most picked"
            >
              {mostGroups.map(([label, items]) => (
                <div key={label} className="min-w-0 bg-slate-950 px-2 py-2.5">
                  <p className="text-[11px] font-black text-slate-300">
                    {label}
                  </p>
                  <div className="grid gap-2">
                    {items.length ? (
                      items.slice(0, 5).map(([name, count]) => (
                        <span key={name} className="block min-w-0">
                          {mostPickedItem(label, name, count)}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-600">
                        Waiting for kickoff
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </section>
          </CollapsiblePanel>
          <CollapsiblePanel
            title="Weekly Standings"
            className="mt-3"
            preview={ownWeeklyRow ? weeklyTable([ownWeeklyRow]) : undefined}
          >
            {weeklyTable(weeklyRows)}
          </CollapsiblePanel>
        </div>
      </GridNavigation>
    </PageShell>
  );
}
