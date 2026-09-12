import { CompactPageHeader } from "@/components/compact-page-header";
import { PageShell } from "@/components/page-shell";
import { WeekSelector } from "@/components/week-selector";
import { TeamLogo } from "@/components/team-logo";
import {
  compareRecords,
  pickOutcome,
  recordForPicks,
  type ScoringGame,
  type ScoringPick,
} from "@/features/competition/scoring";
import { getPoolContext } from "@/lib/pool-context";

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
      className="mx-auto grid h-9 place-items-center text-[8px] font-black leading-none"
    >
      {logo ? (
        <TeamLogo
          team={team}
          src={logo}
          size={30}
          contrast="dark"
          className="size-7"
        />
      ) : (
        team
      )}
      {spread !== undefined && (
        <small className="-mt-1 text-[8px] font-black text-slate-200">
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
    return "bg-amber-950/25 ring-1 ring-inset ring-amber-400";
  const outcome = pickOutcome(game, pick);
  return outcome === "win"
    ? "bg-emerald-950/55 ring-1 ring-inset ring-emerald-700"
    : outcome === "loss"
      ? "bg-red-950/55 ring-1 ring-inset ring-red-800"
      : outcome === "tie"
        ? "bg-slate-700/60 ring-1 ring-inset ring-slate-500"
        : "";
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
        .select("id, label, week_number")
        .eq("season_id", entry.season_id)
        .not("published_at", "is", null)
        .order("week_number")
    : { data: [] };
  const requestedWeek = Number((await searchParams).week);
  const week =
    (weeks ?? []).find((item) => item.week_number === requestedWeek) ??
    weeks?.at(-1) ??
    null;
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
          supabase
            .from("weekly_submissions")
            .select("id, entry_id, revision")
            .eq("week_id", week.id)
            .order("revision", { ascending: false }),
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
    ? await supabase
        .from("picks")
        .select(
          "id, submission_id, game_id, kind, team, total_direction, is_best_bet",
        )
        .in("submission_id", submissionIds)
    : { data: [] };
  const { data: presenceRows } = week
    ? await supabase.rpc("week_submission_presence", {
        target_week_id: week.id,
      })
    : { data: [] };
  const submittedEntries = new Set(
    (presenceRows ?? [])
      .filter(
        (item: { entry_id: number; has_submission: boolean }) =>
          item.has_submission,
      )
      .map(
        (item: { entry_id: number; has_submission: boolean }) => item.entry_id,
      ),
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
    if (!entryId || !kickoff) return [];
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
      if (label === "SD")
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
        ats: recordForPicks(games, picks, ["ats"]),
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

  return (
    <PageShell
      entryCode={entry?.entry_code}
      isCommissioner={isCommissioner}
      compact
      refreshWhileLive={games.some((game) => game.status === "live")}
    >
      <div className="pb-3 sm:pb-5">
        <CompactPageHeader
          sticky
          title="Picks Grid"
          className="mb-3"
          action={
            week ? (
              <WeekSelector weeks={weeks ?? []} selected={week.week_number} />
            ) : undefined
          }
        />
        <section className="game-card overflow-hidden rounded-xl border shadow-xl">
          <div className="overflow-x-auto overscroll-y-auto sm:max-h-[68vh] sm:overflow-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[11px]">
              <thead className="sticky top-0 z-20 bg-slate-950">
                <tr>
                  {[
                    "TM",
                    "BB",
                    "1",
                    "2",
                    "3",
                    "4",
                    "5",
                    "OU1",
                    "OU2",
                    "OU3",
                    "UD",
                    "SD",
                    "Comment",
                  ].map((label, index) => (
                    <th
                      key={label}
                      className={`border-b border-r border-slate-800 px-1 py-2 text-left text-[10px] font-black uppercase text-slate-100 ${index === 0 ? "sticky left-0 z-30 bg-slate-950" : ""}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(entries ?? []).map((poolEntry) => {
                  const picks = visiblePicks.filter(
                    (pick) => pick.entryId === poolEntry.id,
                  );
                  const bb = picks.find(
                    (pick) => pick.kind === "ats" && pick.isBestBet,
                  );
                  const ats = picks
                    .filter((pick) => pick.kind === "ats" && !pick.isBestBet)
                    .sort(
                      (a, b) =>
                        a.kickoff.localeCompare(b.kickoff) ||
                        a.gameId - b.gameId,
                    );
                  const totals = picks
                    .filter((pick) => pick.kind === "total")
                    .sort(
                      (a, b) =>
                        a.kickoff.localeCompare(b.kickoff) ||
                        a.gameId - b.gameId,
                    );
                  const ud = picks.find((pick) => pick.kind === "underdog");
                  const sd = picks.find((pick) => pick.kind === "sudden_death");
                  const cells = [
                    bb,
                    ...Array.from({ length: 5 }, (_, i) => ats[i]),
                    ...Array.from({ length: 3 }, (_, i) => totals[i]),
                    ud,
                    sd,
                  ];
                  return (
                    <tr
                      key={poolEntry.id}
                      className={
                        poolEntry.id === entry?.id ? "bg-slate-800/40" : ""
                      }
                    >
                      <th className="sticky left-0 z-10 border-b border-r border-slate-800 bg-[#111417] px-2 py-1.5 text-left font-black">
                        {poolEntry.entry_code}
                      </th>
                      {cells.map((pick, index) => (
                        <td
                          key={index}
                          className={`h-10 min-w-10 border-b border-r border-slate-800 px-0.5 text-center ${pick ? resultTone(gameMap.get(pick.gameId), pick) : ""}`}
                        >
                          {pick ? (
                            pick.kind === "total" ? (
                              <span
                                title={`${gameMap.get(pick.gameId)?.away} at ${gameMap.get(pick.gameId)?.home}`}
                                className="text-[9px] font-black"
                              >
                                {gameMap.get(pick.gameId)?.away}/
                                {gameMap.get(pick.gameId)?.home}
                                <br />
                                <b>
                                  {pick.totalDirection === "over"
                                    ? "OVER"
                                    : "UNDER"}
                                </b>
                              </span>
                            ) : (
                              <TeamMark
                                team={pick.team!}
                                logo={logoMap.get(pick.team!)}
                                spread={
                                  pick.kind === "underdog"
                                    ? pick.team ===
                                      gameMap.get(pick.gameId)?.away
                                      ? gameMap.get(pick.gameId)?.awaySpread
                                      : -(
                                          gameMap.get(pick.gameId)
                                            ?.awaySpread ?? 0
                                        )
                                    : undefined
                                }
                              />
                            )
                          ) : submittedEntries.has(poolEntry.id) ? (
                            <span className="text-slate-700">—</span>
                          ) : null}
                        </td>
                      ))}
                      <td className="max-w-52 border-b border-slate-800 px-3 py-2 text-[10px] leading-4 text-slate-400">
                        {commentMap.get(poolEntry.id) ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-4 border-t border-slate-800 bg-slate-950 px-3 py-2 text-[9px] font-bold text-slate-400">
            <span className="text-emerald-400">Win</span>
            <span className="text-red-400">Loss</span>
            <span className="text-slate-300">Tie</span>
            <span className="text-amber-300">Live</span>
            <span>— = submitted</span>
          </div>
        </section>
        <details className="game-card mt-4 rounded-xl border">
          <summary className="cursor-pointer px-3 py-3 text-xs font-black uppercase">
            Most Picked{" "}
            <span className="ml-2 text-[10px] font-normal text-slate-500">
              {[most.ats, most.totals, most.ud, most.sd]
                .flatMap((items) => items.slice(0, 2).map(([name]) => name))
                .slice(0, 4)
                .join(" · ") || "Waiting for kickoff"}
            </span>
          </summary>
          <section
            className="grid grid-cols-2 gap-2 border-t border-slate-800 p-3 md:grid-cols-4"
            aria-label="Most picked"
          >
            {(
              [
                ["MAIN", most.ats],
                ["O/U", most.totals],
                ["UD", most.ud],
                ["SD", most.sd],
              ] as const
            ).map(([label, items]) => (
              <div key={label}>
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                  {label}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {items.length ? (
                    items.map(([name, count]) => (
                      <span
                        key={name}
                        className={`rounded bg-slate-800 px-2 py-1 text-[10px] font-black ${outcomeTextTone(mostPickedOutcome(label, name))}`}
                      >
                        {count} {name}
                        {label === "MAIN" &&
                          ` (${consensusPicks.filter((pick) => pick.kind === "ats" && pick.team === name && pick.isBestBet).length} BB)`}
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
        </details>
        <details className="game-card mt-3 rounded-xl border">
          <summary className="cursor-pointer px-3 py-3 text-xs font-black uppercase">
            Results
          </summary>
          <div className="overflow-x-auto border-t border-slate-800">
            <table className="w-full min-w-[330px] text-[10px]">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  {["RK", "TM", "OVR", "ATS", "O/U"].map((header) => (
                    <th key={header} className="px-2 py-2 text-left">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeklyRows.map(
                  ({ poolEntry, overall, ats, totals }, index) => {
                    const show = (record: typeof overall) =>
                      `${record.wins}-${record.losses}-${record.ties}`;
                    return (
                      <tr
                        key={poolEntry.id}
                        className={
                          poolEntry.id === entry?.id ? "bg-slate-800/50" : ""
                        }
                      >
                        <td className="border-t border-slate-800 px-2 py-2 text-slate-500">
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
                  },
                )}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </PageShell>
  );
}
