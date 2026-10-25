import {
  EntryPerformanceProvider,
  EntryDetailButton,
} from "@/components/entry-performance";
import {
  performanceHistory,
  sideOrder,
  mainPayoutExplanation,
} from "@/features/competition/performance";
import { resultVisualClass } from "@/features/competition/result-style";
import { TeamLogo } from "@/components/team-logo";

import { CompactPageHeader } from "@/components/compact-page-header";
import { PageShell } from "@/components/page-shell";
import { WeekSelector } from "@/components/week-selector";
import { StandingsTabs, StandingsTitle } from "@/components/standings-tabs";
import { StickyTableHeader } from "@/components/sticky-table-header";
import { loadCompetition } from "@/features/competition/data";
import {
  gamesBack,
  suddenDeathEliminationsByWeek,
  pickOutcome,
  ranksByGamesBack,
  recordForPicks,
  type ScoringGame,
} from "@/features/competition/scoring";
import { getPoolContext } from "@/lib/pool-context";
import { selectPoolWeek } from "@/lib/pool-weeks";

export const dynamic = "force-dynamic";

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string }>;
}) {
  const { supabase, entry, isCommissioner } = await getPoolContext();
  const params = await searchParams;
  const view = params.view ?? "overall";
  const { data: availableWeeks } = entry
    ? await supabase
        .from("pool_weeks")
        .select("id, week_number, label, lines_freeze_at")
        .eq("season_id", entry.season_id)
        .not("published_at", "is", null)
        .order("week_number")
    : { data: [] };
  const isSidePool = view === "sd" || view === "ud";
  const requestedWeek = isSidePool ? NaN : Number(params.week);
  const selectedWeek = selectPoolWeek(availableWeeks ?? [], requestedWeek);
  const data =
    entry && selectedWeek
      ? await loadCompetition(
          supabase,
          entry.season_id,
          isSidePool ? undefined : selectedWeek.week_number,
          {
            includeComments: false,
            includePayouts: true,
            includeTeams: view === "sd" || view === "ud",
          },
        )
      : null;
  const entryMap = new Map(data?.entries.map((item) => [item.id, item]));
  const gameMap = new Map(data?.games.map((game) => [game.id, game]));
  const logoMap = new Map(
    data?.teams.map((team) => [team.abbreviation, team.logo_url]),
  );
  const ranks = ranksByGamesBack(data?.standings ?? []);

  const history = data
    ? performanceHistory(
        data.entries.map((e) => e.id),
        data.games,
        data.picks,
      )
    : new Map();
  const orderedIds = data
    ? isSidePool
      ? sideOrder(
          data.standings,
          data.entries,
          view as "sd" | "ud",
        ).ordered.map((e) => e.id)
      : data.standings.map((e) => e.entryId)
    : [];
  const maxUd = Math.max(
    0,
    ...(data?.standings.map((s) => s.underdogPoints) ?? []),
  );
  const sdWinners =
    data?.standings.filter((s) => !s.eliminated).map((s) => s.entryId) ?? [];
  const udWinners =
    data?.standings
      .filter((s) => s.underdogPoints === maxUd)
      .map((s) => s.entryId) ?? [];
  const detailEntries = orderedIds.map((id) => {
    const amounts = data!.financials.get(id)!;
    const sideExplanation = (kind: "sd" | "ud", winners: number[]) =>
      winners.length === 0
        ? "No winner currently projected: no payment."
        : winners.length === data!.entries.length
          ? "All entries tied: no payment."
          : `$${data!.sidePots[kind].toFixed(2)} combined payout ÷ ${winners.includes(id) ? `${winners.length} tied winners` : `${data!.entries.length - winners.length} losing entries sharing the cost`}.`;
    return {
      id,
      name: entryMap.get(id)?.entry_code ?? "",
      history: history.get(id) ?? [],
      payouts: [
        {
          label: "Main",
          amount: amounts.main,
          explanation: mainPayoutExplanation(
            id,
            data!.standings,
            data!.payoutRows,
          ),
        },
        {
          label: "SD",
          amount: amounts.sd,
          explanation: sideExplanation("sd", sdWinners),
        },
        {
          label: "UD",
          amount: amounts.ud,
          explanation: sideExplanation("ud", udWinners),
        },
        {
          label: "Total",
          amount: amounts.net,
          explanation: `Main $${amounts.main.toFixed(2)} + SD $${amounts.sd.toFixed(2)} + UD $${amounts.ud.toFixed(2)}. Projected until the season is finalized.`,
        },
      ],
    };
  });

  return (
    <PageShell
      entryCode={entry?.entry_code}
      isCommissioner={isCommissioner}
      compact
      refreshWhileLive={Boolean(
        data?.games.some((game) => game.status === "live"),
      )}
    >
      <EntryPerformanceProvider entries={detailEntries}>
        <div className="pb-3 sm:pb-5">
          <CompactPageHeader
            sticky
            title={<StandingsTitle />}
            className="mb-3"
            action={
              selectedWeek ? (
                <div className="flex items-center gap-1.5">
                  <StandingsTabs
                    view={view}
                    weekNumber={selectedWeek.week_number}
                  />
                  {!isSidePool && (
                    <WeekSelector
                      weeks={availableWeeks ?? []}
                      selected={selectedWeek.week_number}
                      preserve={{ view }}
                    />
                  )}
                </div>
              ) : undefined
            }
          />
          {view === "overall" ? (
            <section className="game-card overflow-clip rounded-xl border shadow-xl">
              <StickyTableHeader columnWidths={[24, 42, 52, 28, 44, 64, 82]}>
                <table className="w-full border-separate border-spacing-0 text-[10px]">
                  <thead className="bg-slate-950">
                    <tr>
                      {[
                        "RK",
                        "TM",
                        "W-L-T",
                        "GB",
                        "UD Pts",
                        "SD Strikes",
                        "Projected $",
                      ].map((header, index) => (
                        <th
                          key={header}
                          className={`whitespace-nowrap border-b border-slate-800 px-0.5 py-2 text-left text-[10px] font-black uppercase text-slate-100 ${index === 0 ? "w-5" : ""} ${index === 1 ? "sticky left-0 z-30 w-9 bg-slate-950" : ""} ${index === 2 ? "w-11" : ""} ${index === 3 ? "w-6" : ""} ${index >= 4 ? "w-10" : ""}`}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data?.standings.map((standing) => (
                      <tr
                        key={standing.entryId}
                        className={
                          standing.entryId === entry?.id
                            ? "bg-slate-800/50"
                            : ""
                        }
                      >
                        <td className="w-5 border-b border-slate-800 px-0.5 py-2 text-left font-black text-slate-400">
                          {ranks.get(standing.entryId)}
                        </td>
                        <th className="sticky left-0 w-9 border-b border-slate-800 bg-[#111417] px-0.5 py-2 text-left font-black">
                          <EntryDetailButton entryId={standing.entryId}>
                            {entryMap.get(standing.entryId)?.entry_code}
                          </EntryDetailButton>
                        </th>
                        <td className="w-11 border-b border-slate-800 px-0.5 py-2 text-left">
                          {standing.wins}-{standing.losses}-{standing.ties}
                        </td>
                        <td className="w-6 border-b border-slate-800 px-0.5 py-2 text-left">
                          {gamesBack(standing, data.standings).toFixed(1)}
                        </td>
                        <td className="w-10 border-b border-slate-800 px-0.5 py-2 text-left font-black text-fuchsia-300">
                          {standing.underdogPoints.toFixed(1)}
                        </td>
                        <td className="w-10 border-b border-slate-800 px-0.5 py-2 text-left">
                          <span
                            className={
                              standing.eliminated
                                ? "text-red-400"
                                : "text-cyan-300"
                            }
                          >
                            {standing.suddenDeathStrikes}/2
                          </span>
                        </td>
                        <td className="w-11 border-b border-slate-800 px-0.5 py-2 text-left font-black">
                          {formatMoney(
                            data.financials.get(standing.entryId)?.net ?? 0,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </StickyTableHeader>
              <p className="border-t border-slate-800 px-3 py-2 text-[9px] text-slate-500">
                Dollar values are projected until the season is finalized.
              </p>
            </section>
          ) : view === "main" ? (
            <MainBreakdownTable data={data} entryId={entry?.id} ranks={ranks} />
          ) : (
            <SidePoolTable
              kind={view === "sd" ? "sudden_death" : "underdog"}
              data={data}
              entryMap={entryMap}
              gameMap={gameMap}
              logoMap={logoMap}
            />
          )}
        </div>
      </EntryPerformanceProvider>
    </PageShell>
  );
}

function displayRecord(record: { wins: number; losses: number; ties: number }) {
  return `${record.wins}-${record.losses}-${record.ties}`;
}

function MainBreakdownTable({
  data,
  entryId,
  ranks,
}: {
  data: CompetitionData | null;
  entryId?: number;
  ranks: Map<number, number>;
}) {
  return (
    <section className="game-card overflow-clip rounded-xl border">
      <StickyTableHeader columnWidths={[24, 40, 48, 48, 48, 48]}>
        <table className="w-full border-separate border-spacing-0 text-[10px]">
          <thead className="bg-slate-950">
            <tr>
              {["RK", "TM", "W-L-T", "BB", "ATS", "O/U"].map(
                (header, index) => (
                  <th
                    key={header}
                    className={`whitespace-nowrap border-b border-slate-800 px-1 py-2 text-left text-[10px] font-black uppercase text-slate-100 ${index === 0 ? "w-6" : ""} ${index === 1 ? "sticky left-0 w-10 bg-slate-950" : ""} ${index >= 2 ? "w-12" : ""}`}
                  >
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data?.standings.map((standing) => {
              const picks = data.picks.filter(
                (pick) => pick.entryId === standing.entryId,
              );
              return (
                <tr
                  key={standing.entryId}
                  className={
                    standing.entryId === entryId ? "bg-slate-800/50" : ""
                  }
                >
                  <td className="w-6 border-b border-slate-800 px-1 py-2 text-left text-slate-400">
                    {ranks.get(standing.entryId)}
                  </td>
                  <th className="sticky left-0 w-10 border-b border-slate-800 bg-[#111417] px-1 py-2 text-left">
                    <EntryDetailButton entryId={standing.entryId}>
                      {
                        data.entries.find(
                          (item) => item.id === standing.entryId,
                        )?.entry_code
                      }
                    </EntryDetailButton>
                  </th>
                  <td className="w-12 border-b border-slate-800 px-1 py-2 text-left font-black">
                    {standing.wins}-{standing.losses}-{standing.ties}
                  </td>
                  <td className="w-12 border-b border-slate-800 px-1 py-2 text-left">
                    {displayRecord(
                      recordForPicks(
                        data.games,
                        picks.filter((pick) => pick.isBestBet),
                        ["ats"],
                      ),
                    )}
                  </td>
                  <td className="w-12 border-b border-slate-800 px-1 py-2 text-left">
                    {displayRecord(recordForPicks(data.games, picks, ["ats"]))}
                  </td>
                  <td className="w-12 border-b border-slate-800 px-1 py-2 text-left">
                    {displayRecord(
                      recordForPicks(data.games, picks, ["total"]),
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </StickyTableHeader>
    </section>
  );
}

function formatMoney(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}$${Math.abs(value).toFixed(value % 1 ? 2 : 0)}`;
}

type CompetitionData = Awaited<ReturnType<typeof loadCompetition>>;
function SidePoolTable({
  kind,
  data,
  entryMap,
  gameMap,
  logoMap,
}: {
  kind: "sudden_death" | "underdog";
  data: CompetitionData | null;
  entryMap: Map<number, { entry_code: string }>;
  gameMap: Map<number, ScoringGame>;
  logoMap: Map<string, string | null>;
}) {
  if (!data) return null;
  const eliminatedByWeek =
    kind === "sudden_death"
      ? suddenDeathEliminationsByWeek(
          data.entries.map((entry) => entry.id),
          data.games,
          data.picks,
        )
      : new Map<number, Set<number>>();
  const { ordered: sortedEntries, ranks: sideRanks } = sideOrder(
    data.standings,
    data.entries,
    kind === "underdog" ? "ud" : "sd",
  );
  return (
    <section className="game-card overflow-clip rounded-xl border">
      <StickyTableHeader
        columnWidths={[28, 44, ...data.weeks.map(() => 48), 64]}
      >
        <table className="w-max min-w-full border-separate border-spacing-0 text-[11px]">
          <thead className="bg-slate-950">
            <tr>
              <th className="sticky left-0 z-30 w-7 min-w-7 bg-slate-950 px-1 py-2 text-left">
                RK
              </th>
              <th className="sticky left-7 z-20 w-11 min-w-11 bg-slate-950 px-1 py-2 text-left">
                TM
              </th>
              {data.weeks.map((week) => (
                <th key={week.id} className="w-12 min-w-12 px-1 py-2 text-left">
                  W{week.week_number}
                </th>
              ))}
              <th className="sticky right-0 z-20 min-w-16 bg-slate-950 px-1.5 py-2 text-right">
                {kind === "sudden_death" ? "Strikes" : "Points"}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((poolEntry) => {
              const standing = data.standings.find(
                (item) => item.entryId === poolEntry.id,
              );
              return (
                <tr key={poolEntry.id}>
                  <td className="sticky left-0 z-20 w-7 min-w-7 border-t border-slate-800 bg-[#111417] px-1 py-2 text-left text-slate-500">
                    {sideRanks.get(poolEntry.id)}
                  </td>
                  <th className="sticky left-7 z-10 w-11 min-w-11 border-t border-slate-800 bg-[#111417] px-1 py-2 text-left">
                    <EntryDetailButton entryId={poolEntry.id}>
                      {entryMap.get(poolEntry.id)?.entry_code}
                    </EntryDetailButton>
                  </th>
                  {data.weeks.map((week) => {
                    const ineligible =
                      eliminatedByWeek.get(week.id)?.has(poolEntry.id) ?? false;
                    const pick = data.picks.find(
                      (item) =>
                        item.entryId === poolEntry.id &&
                        item.kind === kind &&
                        gameMap.get(item.gameId)?.weekId === week.id,
                    );
                    const game = pick ? gameMap.get(pick.gameId) : undefined;
                    const outcome =
                      pick && game ? pickOutcome(game, pick) : "pending";
                    const points =
                      kind === "underdog" && outcome === "win" && pick && game
                        ? Math.abs(
                            pick.team === game.away
                              ? game.awaySpread
                              : -game.awaySpread,
                          )
                        : 0;
                    return (
                      <td
                        key={week.id}
                        className={`w-12 min-w-12 border-t border-slate-800 px-1 py-1.5 text-center ${!ineligible && game?.status === "final" ? resultVisualClass("final", outcome) : ""}`}
                        aria-label={
                          ineligible
                            ? `Eliminated before Week ${week.week_number}`
                            : `${pick?.team ?? "No pick"}: ${outcome}${points ? `, +${points} points` : ""}`
                        }
                        title={
                          ineligible && pick?.team
                            ? `${pick.team} was submitted after elimination and does not count`
                            : undefined
                        }
                      >
                        <span className="mx-auto flex min-h-10 flex-col items-center justify-center font-black">
                          {ineligible ? (
                            "OUT"
                          ) : pick?.team ? (
                            <TeamLogo
                              team={pick.team}
                              src={logoMap.get(pick.team)}
                              size={32}
                              contrast="dark"
                              className="size-8 object-contain"
                            />
                          ) : (
                            "—"
                          )}
                          {kind === "underdog" && outcome === "win" && (
                            <small className="text-[9px] leading-none">
                              +{points}
                            </small>
                          )}
                        </span>
                      </td>
                    );
                  })}
                  <td className="sticky right-0 border-t border-slate-800 bg-[#111417] px-1.5 text-right font-black">
                    {kind === "sudden_death"
                      ? `${standing?.eliminated ? "✕ ELIM · " : ""}${standing?.suddenDeathStrikes ?? 0}/2`
                      : (standing?.underdogPoints ?? 0).toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </StickyTableHeader>
    </section>
  );
}
