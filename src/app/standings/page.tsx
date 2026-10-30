import {
  sdBeforeWeek,
  type SdResult,
} from "@/features/competition/sd-contests";
import {
  EntryPerformanceProvider,
  EntryDetailRow,
} from "@/components/entry-performance";
import {
  performanceHistory,
  sideOrder,
  mainPayoutExplanation,
} from "@/features/competition/performance";
import { resultVisualClass } from "@/features/competition/result-style";
import { TableTeam } from "@/components/table-team";
import { StrikeMark, underdogRankColor } from "@/components/standing-marks";

import { CompactPageHeader } from "@/components/compact-page-header";
import { PageShell } from "@/components/page-shell";
import { WeekSelector } from "@/components/week-selector";
import { StandingsTabs, StandingsTitle } from "@/components/standings-tabs";
import { StickyTableHeader } from "@/components/sticky-table-header";
import { loadCompetition } from "@/features/competition/data";
import {
  gamesBack,
  winningPercentage,
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
  const view = params.view === "sd" ? "sd1" : (params.view ?? "overall");
  const { data: availableWeeks } = entry
    ? await supabase
        .from("pool_weeks")
        .select("id, week_number, label, lines_freeze_at")
        .eq("season_id", entry.season_id)
        .not("published_at", "is", null)
        .order("week_number")
    : { data: [] };
  const isSidePool = view === "sd1" || view === "sd2" || view === "ud";
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
            includeTeams: view === "sd1" || view === "sd2" || view === "ud",
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
  const selectedContest = data?.sdContests.find(
    (c) => c.number === (view === "sd2" ? 2 : 1),
  );
  const orderedIds = data
    ? isSidePool
      ? sideOrder(
          view === "ud"
            ? data.standings
            : (selectedContest?.standings ?? data.standings),
          selectedContest && view !== "ud"
            ? data.entries.filter((e) =>
                selectedContest.participantIds.includes(e.id),
              )
            : data.entries,
          view === "ud" ? "ud" : "sd",
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
    const sideExplanation = (kind: "sd" | "sd2" | "ud", winners: number[]) =>
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
          label: "SD1",
          amount: amounts.sd,
          explanation: sideExplanation("sd", sdWinners),
        },
        {
          label: "SD2",
          amount: amounts.sd2,
          explanation: sideExplanation(
            "sd2",
            data!.sdContests
              .find((c) => c.number === 2)
              ?.standings.filter((s) => !s.eliminated)
              .map((s) => s.entryId) ?? [],
          ),
        },
        {
          label: "UD",
          amount: amounts.ud,
          explanation: sideExplanation("ud", udWinners),
        },
        {
          label: "Total",
          amount: amounts.net,
          explanation: `Main $${amounts.main.toFixed(2)} + SD1 $${amounts.sd.toFixed(2)} + SD2 $${amounts.sd2.toFixed(2)} + UD $${amounts.ud.toFixed(2)}. Projected until the season is finalized.`,
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
          {view === "overall" || view === "main" ? (
            <RecordTable
              data={data}
              entryId={entry?.id}
              ranks={ranks}
              overall={view === "overall"}
            />
          ) : (
            <SidePoolTable
              kind={view === "ud" ? "underdog" : "sudden_death"}
              contest={view === "ud" ? undefined : selectedContest}
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

function RecordTable({
  data,
  entryId,
  ranks,
  overall,
}: {
  data: CompetitionData | null;
  entryId?: number;
  ranks: Map<number, number>;
  overall: boolean;
}) {
  const udRanks = data
    ? sideOrder(data.standings, data.entries, "ud").ranks
    : new Map<number, number>();
  const headers = overall
    ? ["RK", "TM", "W-L-T", "Win %", "GB", "UD Pts", "SD1", "SD2", "Payout"]
    : ["RK", "TM", "W-L-T", "BB", "ATS", "O/U", "Payout"];
  return (
    <section className="game-card overflow-clip rounded-xl border shadow-xl">
      <StickyTableHeader
        columnWidths={
          overall
            ? [44, 64, 82, 64, 52, 64, 52, 52, 92]
            : [44, 64, 82, 72, 72, 72, 92]
        }
      >
        <table className="pool-table w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {headers.map((header, i) => (
                <th
                  key={header}
                  scope="col"
                  className={
                    i === 0
                      ? "rank-cell sticky left-0 z-30"
                      : i === 1
                        ? "entry-cell sticky left-11 z-20"
                        : i === headers.length - 1
                          ? "payout-cell sticky right-0 z-20"
                          : ""
                  }
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.standings.map((standing) => {
              const picks = data.picks.filter(
                (pick) => pick.entryId === standing.entryId,
              );
              const name =
                data.entries.find((e) => e.id === standing.entryId)
                  ?.entry_code ?? "";
              return (
                <EntryDetailRow
                  key={standing.entryId}
                  entryId={standing.entryId}
                  name={name}
                  className={standing.entryId === entryId ? "own-entry" : ""}
                >
                  <td className="rank-cell sticky left-0 z-20">
                    {ranks.get(standing.entryId)}
                  </td>
                  <th scope="row" className="entry-cell sticky left-11 z-10">
                    {name}
                  </th>
                  <td className="whitespace-nowrap font-bold">
                    {displayRecord(standing)}
                  </td>
                  {overall ? (
                    <>
                      <td>{winningPercentage(standing)}</td>
                      <td>{gamesBack(standing, data.standings).toFixed(1)}</td>
                      <td
                        className={`font-black ${underdogRankColor(udRanks.get(standing.entryId) ?? 99)}`}
                      >
                        {standing.underdogPoints.toFixed(1)}
                      </td>
                      <td>
                        <StrikeMark strikes={standing.suddenDeathStrikes} />
                      </td>
                      <td>
                        {(() => {
                          const c = data.sdContests.find((c) => c.number === 2);
                          const row = c?.standings.find(
                            (s) => s.entryId === standing.entryId,
                          );
                          return c?.started && row ? (
                            <StrikeMark
                              strikes={row.suddenDeathStrikes}
                              limit={c.strike_limit}
                            />
                          ) : (
                            <span aria-label="SD2 not started">—</span>
                          );
                        })()}
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        {displayRecord(
                          recordForPicks(
                            data.games,
                            picks.filter((pick) => pick.isBestBet),
                            ["ats"],
                          ),
                        )}
                      </td>
                      <td>
                        {displayRecord(
                          recordForPicks(data.games, picks, ["ats"], true),
                        )}
                      </td>
                      <td>
                        {displayRecord(
                          recordForPicks(data.games, picks, ["total"]),
                        )}
                      </td>
                    </>
                  )}
                  <td className="payout-cell sticky right-0 z-10 font-black">
                    {formatMoney(
                      data.financials.get(standing.entryId)?.[
                        overall ? "net" : "main"
                      ] ?? 0,
                    )}
                  </td>
                </EntryDetailRow>
              );
            })}
          </tbody>
        </table>
      </StickyTableHeader>
      <p className="border-t border-slate-700 px-3 py-2 text-xs text-slate-300">
        Payouts reflect results through the selected week.
        {!overall &&
          " ATS includes Best Bet twice; BB shows its separate record."}
      </p>
    </section>
  );
}
function formatMoney(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}$${Math.abs(value).toFixed(value % 1 ? 2 : 0)}`;
}
type CompetitionData = Awaited<ReturnType<typeof loadCompetition>>;
function SidePoolTable({
  kind,
  contest,
  data: sourceData,
  entryMap,
  gameMap,
  logoMap,
}: {
  kind: "sudden_death" | "underdog";
  contest?: SdResult;
  data: CompetitionData | null;
  entryMap: Map<number, { entry_code: string }>;
  gameMap: Map<number, ScoringGame>;
  logoMap: Map<string, string | null>;
}) {
  if (!sourceData) return null;
  const data = contest
    ? {
        ...sourceData,
        entries: sourceData.entries.filter((e) =>
          contest.participantIds.includes(e.id),
        ),
        weeks: sourceData.weeks.filter(
          (w) =>
            w.week_number >= contest.start_week &&
            w.week_number <= (contest.completedWeek ?? contest.end_week),
        ),
        standings: contest.standings,
        picks: sourceData.picks.filter((p) => p.sdContestId === contest.id),
      }
    : sourceData;
  const sd = kind === "sudden_death";
  const eliminatedByWeek = contest
    ? new Map(
        data.weeks.map((w) => {
          const prior = sdBeforeWeek(
            contest,
            sourceData.games,
            sourceData.picks,
            w.week_number,
          );
          return [
            w.id,
            new Set(
              prior.standings
                .filter((s) => s.eliminated || prior.completedWeek !== null)
                .map((s) => s.entryId),
            ),
          ];
        }),
      )
    : sd
      ? suddenDeathEliminationsByWeek(
          data.entries.map((e) => e.id),
          data.games,
          data.picks,
        )
      : new Map<number, Set<number>>();
  const { ordered, ranks } = sideOrder(
    data.standings,
    data.entries,
    sd ? "sd" : "ud",
  );
  return (
    <section className="game-card overflow-clip rounded-xl border">
      <StickyTableHeader
        columnWidths={[44, 64, ...data.weeks.map(() => 56), 68, 92]}
      >
        <table className="pool-table w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th scope="col" className="rank-cell sticky left-0 z-30">
                RK
              </th>
              <th scope="col" className="entry-cell sticky left-11 z-20">
                TM
              </th>
              {data.weeks.map((w) => (
                <th scope="col" key={w.id} className="text-center">
                  W{w.week_number}
                </th>
              ))}
              <th scope="col">{sd ? "Strikes" : "Points"}</th>
              <th scope="col" className="payout-cell sticky right-0 z-20">
                Payout
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((poolEntry) => {
              const standing = data.standings.find(
                (s) => s.entryId === poolEntry.id,
              )!;
              return (
                <EntryDetailRow
                  key={poolEntry.id}
                  entryId={poolEntry.id}
                  name={entryMap.get(poolEntry.id)?.entry_code ?? ""}
                >
                  <td className="rank-cell sticky left-0 z-20">
                    {ranks.get(poolEntry.id)}
                  </td>
                  <th scope="row" className="entry-cell sticky left-11 z-10">
                    {poolEntry.entry_code}
                  </th>
                  {data.weeks.map((week) => {
                    const ineligible =
                      eliminatedByWeek.get(week.id)?.has(poolEntry.id) ?? false;
                    const pick = data.picks.find(
                      (p) =>
                        p.entryId === poolEntry.id &&
                        p.kind === kind &&
                        gameMap.get(p.gameId)?.weekId === week.id,
                    );
                    const game = pick ? gameMap.get(pick.gameId) : undefined;
                    const outcome =
                      pick && game ? pickOutcome(game, pick) : "pending";
                    const points =
                      !sd && outcome === "win" && pick && game
                        ? Math.abs(game.awaySpread)
                        : 0;
                    return (
                      <td
                        key={week.id}
                        className={`text-center ${!ineligible && game?.status === "final" ? resultVisualClass("final", outcome) : ""}`}
                        aria-label={
                          ineligible
                            ? `Eliminated before Week ${week.week_number}`
                            : `${pick?.team ?? "No pick"}: ${outcome}${points ? `, +${points} points` : ""}`
                        }
                      >
                        <span className="flex min-h-10 flex-col items-center justify-center font-black">
                          {!ineligible && pick?.team ? (
                            <TableTeam
                              team={pick.team}
                              src={logoMap.get(pick.team)}
                            />
                          ) : (
                            "—"
                          )}
                          {points > 0 && (
                            <small className="text-xs">+{points}</small>
                          )}
                        </span>
                      </td>
                    );
                  })}
                  <td className="font-black">
                    {sd ? (
                      <StrikeMark
                        strikes={standing.suddenDeathStrikes}
                        limit={contest?.strike_limit}
                      />
                    ) : (
                      <span
                        className={underdogRankColor(
                          ranks.get(poolEntry.id) ?? 99,
                        )}
                      >
                        {standing.underdogPoints.toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td className="payout-cell sticky right-0 z-10 font-black">
                    {formatMoney(
                      data.financials.get(poolEntry.id)?.[
                        sd ? (contest?.number === 2 ? "sd2" : "sd") : "ud"
                      ] ?? 0,
                    )}
                  </td>
                </EntryDetailRow>
              );
            })}
          </tbody>
        </table>
      </StickyTableHeader>
      <p className="border-t border-slate-700 px-3 py-2 text-xs text-slate-300">
        {contest?.completedWeek ? "Final" : "Current projected"}{" "}
        {sd ? `SD${contest?.number ?? 1}` : "Underdog"} payouts.
      </p>
    </section>
  );
}
