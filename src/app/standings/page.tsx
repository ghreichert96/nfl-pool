import Image from "next/image";

import { PageHeading, PageShell } from "@/components/page-shell";
import { WeekSelector } from "@/components/week-selector";
import { StandingsTabs } from "@/components/standings-tabs";
import { loadCompetition } from "@/features/competition/data";
import {
  gamesBack,
  pickOutcome,
  recordForPicks,
  type ScoringGame,
} from "@/features/competition/scoring";
import { getPoolContext } from "@/lib/pool-context";

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
        .select("id, week_number, label")
        .eq("season_id", entry.season_id)
        .not("published_at", "is", null)
        .order("week_number")
    : { data: [] };
  const requestedWeek = Number(params.week);
  const selectedWeek =
    (availableWeeks ?? []).find((week) => week.week_number === requestedWeek) ??
    availableWeeks?.at(-1) ??
    null;
  const data =
    entry && selectedWeek
      ? await loadCompetition(
          supabase,
          entry.season_id,
          selectedWeek.week_number,
          {
            includeComments: false,
            includePayouts: view === "overall",
            includeTeams: view === "sd" || view === "ud",
          },
        )
      : null;
  const entryMap = new Map(data?.entries.map((item) => [item.id, item]));
  const gameMap = new Map(data?.games.map((game) => [game.id, game]));
  const logoMap = new Map(
    data?.teams.map((team) => [team.abbreviation, team.logo_url]),
  );
  const ranks = new Map<number, number>();
  let priorKey = "",
    rank = 0;
  data?.standings.forEach((standing, index) => {
    const key = `${standing.wins}:${standing.losses}:${standing.ties}`;
    if (key !== priorKey) rank = index + 1;
    ranks.set(standing.entryId, rank);
    priorKey = key;
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
      <div className="py-3 sm:py-5">
        <PageHeading
          eyebrow=""
          title="Weekly Standings"
          action={
            selectedWeek ? (
              <WeekSelector
                weeks={availableWeeks ?? []}
                selected={selectedWeek.week_number}
                preserve={{ view }}
              />
            ) : undefined
          }
        />
        <StandingsTabs view={view} weekNumber={selectedWeek?.week_number} />
        {view === "overall" ? (
          <section className="game-card overflow-hidden rounded-xl border shadow-xl">
            <div className="max-h-[68vh] overflow-auto">
              <table className="w-full border-separate border-spacing-0 text-[10px]">
                <thead className="sticky top-0 z-20 bg-slate-950">
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
                        className={`whitespace-nowrap border-b border-slate-800 px-1 py-2 text-left text-[8px] uppercase text-slate-400 ${index === 0 ? "w-6" : ""} ${index === 1 ? "sticky left-0 z-30 w-10 bg-slate-950" : ""} ${index === 2 ? "w-12" : ""} ${index === 3 ? "w-7" : ""} ${index >= 4 ? "w-11" : ""}`}
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
                        standing.entryId === entry?.id ? "bg-slate-800/50" : ""
                      }
                    >
                      <td className="w-6 border-b border-slate-800 px-1 py-2 text-left font-black text-slate-400">
                        {ranks.get(standing.entryId)}
                      </td>
                      <th className="sticky left-0 w-10 border-b border-slate-800 bg-[#111417] px-1 py-2 text-left font-black">
                        {entryMap.get(standing.entryId)?.entry_code}
                      </th>
                      <td className="w-12 border-b border-slate-800 px-1 py-2 text-left">
                        {standing.wins}-{standing.losses}-{standing.ties}
                      </td>
                      <td className="w-7 border-b border-slate-800 px-1 py-2 text-left">
                        {gamesBack(standing, data.standings).toFixed(1)}
                      </td>
                      <td className="w-11 border-b border-slate-800 px-1 py-2 text-left font-black text-fuchsia-300">
                        {standing.underdogPoints.toFixed(1)}
                      </td>
                      <td className="w-11 border-b border-slate-800 px-1 py-2 text-left">
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
                      <td className="w-12 border-b border-slate-800 px-1 py-2 text-left font-black">
                        {formatMoney(
                          data.financials.get(standing.entryId)?.net ?? 0,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
    <section className="game-card overflow-hidden rounded-xl border">
      <div className="overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px]">
          <thead className="sticky top-0 z-20 bg-slate-950">
            <tr>
              {["RK", "TM", "W-L-T", "BB", "ATS", "O/U"].map(
                (header, index) => (
                  <th
                    key={header}
                    className={`whitespace-nowrap border-b border-slate-800 px-1 py-2 text-left text-[8px] uppercase text-slate-400 ${index === 0 ? "w-6" : ""} ${index === 1 ? "sticky left-0 w-10 bg-slate-950" : ""} ${index >= 2 ? "w-12" : ""}`}
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
                    {
                      data.entries.find((item) => item.id === standing.entryId)
                        ?.entry_code
                    }
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
      </div>
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
  const sortedEntries = [...data.entries].sort((a, b) => {
    const left = data.standings.find((item) => item.entryId === a.id);
    const right = data.standings.find((item) => item.entryId === b.id);
    return kind === "underdog"
      ? (right?.underdogPoints ?? 0) - (left?.underdogPoints ?? 0)
      : Number(left?.eliminated) - Number(right?.eliminated) ||
          (left?.suddenDeathStrikes ?? 0) - (right?.suddenDeathStrikes ?? 0);
  });
  return (
    <section className="game-card overflow-hidden rounded-xl border">
      <div className="overflow-auto">
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
            {sortedEntries.map((poolEntry, entryIndex) => {
              const standing = data.standings.find(
                (item) => item.entryId === poolEntry.id,
              );
              return (
                <tr
                  key={poolEntry.id}
                  className={standing?.eliminated ? "bg-red-950/35" : ""}
                >
                  <td className="sticky left-0 z-20 w-7 min-w-7 border-t border-slate-800 bg-[#111417] px-1 py-2 text-left text-slate-500">
                    {entryIndex + 1}
                  </td>
                  <th className="sticky left-7 z-10 w-11 min-w-11 border-t border-slate-800 bg-[#111417] px-1 py-2 text-left">
                    {entryMap.get(poolEntry.id)?.entry_code}
                  </th>
                  {data.weeks.map((week) => {
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
                        className="w-12 min-w-12 border-t border-slate-800 px-1 py-1.5 text-left"
                      >
                        <span
                          className={`font-black ${outcome === "win" ? "text-emerald-400" : outcome === "loss" ? "text-red-400" : outcome === "tie" ? "text-slate-300" : "text-slate-600"}`}
                        >
                          {pick?.team && logoMap.get(pick.team) ? (
                            <Image
                              src={logoMap.get(pick.team)!}
                              alt=""
                              width={20}
                              height={20}
                              className="size-5 object-contain object-left"
                            />
                          ) : null}
                          {pick?.team ?? "—"}
                        </span>
                        {pick && (
                          <small
                            className={`block text-[9px] ${outcome === "win" ? "text-emerald-400" : outcome === "loss" ? "text-red-400" : "text-slate-500"}`}
                          >
                            {kind === "underdog" && outcome === "win"
                              ? `✓ +${points}`
                              : outcome === "win"
                                ? "✓ win"
                                : outcome === "loss"
                                  ? "✕ loss"
                                  : outcome === "tie"
                                    ? "— tie"
                                    : "pending"}
                          </small>
                        )}
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
      </div>
    </section>
  );
}
