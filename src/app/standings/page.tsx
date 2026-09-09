import Link from "next/link";
import Image from "next/image";

import { PageHeading, PageShell } from "@/components/page-shell";
import { WeekSelector } from "@/components/week-selector";
import { loadCompetition } from "@/features/competition/data";
import {
  gamesBack,
  pickOutcome,
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
        <nav
          aria-label="Standings views"
          className="mb-4 grid grid-cols-3 rounded-lg border border-slate-700 bg-slate-950 p-1"
        >
          {[
            ["overall", "Overall"],
            ["sd", "Sudden Death"],
            ["ud", "Underdog"],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={`/standings?view=${key}${selectedWeek ? `&week=${selectedWeek.week_number}` : ""}`}
              aria-current={view === key ? "page" : undefined}
              className={`grid min-h-10 place-items-center rounded-md text-[10px] font-black uppercase ${view === key ? "control-pressed" : "text-slate-400"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        {view === "overall" ? (
          <section className="game-card overflow-hidden rounded-xl border shadow-xl">
            <div className="max-h-[68vh] overflow-auto">
              <table className="w-full min-w-[570px] border-separate border-spacing-0 text-[11px]">
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
                        className={`border-b border-slate-800 px-2 py-2 text-right text-[9px] uppercase text-slate-400 ${index === 1 ? "sticky left-0 z-30 bg-slate-950 text-left" : ""}`}
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
                      <td className="border-b border-slate-800 px-2 py-2 text-right font-black text-slate-400">
                        {ranks.get(standing.entryId)}
                      </td>
                      <th className="sticky left-0 border-b border-slate-800 bg-[#111417] px-2 py-2 text-left font-black">
                        {entryMap.get(standing.entryId)?.entry_code}
                      </th>
                      <td className="border-b border-slate-800 px-3 py-3 text-right">
                        {standing.wins}-{standing.losses}-{standing.ties}
                      </td>
                      <td className="border-b border-slate-800 px-3 py-3 text-right">
                        {gamesBack(standing, data.standings).toFixed(1)}
                      </td>
                      <td className="border-b border-slate-800 px-3 py-3 text-right font-black text-fuchsia-300">
                        {standing.underdogPoints.toFixed(1)}
                      </td>
                      <td className="border-b border-slate-800 px-3 py-3 text-right">
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
                      <td className="border-b border-slate-800 px-3 py-3 text-right font-black">
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
  return (
    <section className="game-card overflow-hidden rounded-xl border">
      <div className="overflow-auto">
        <table className="w-full min-w-[620px] text-[11px]">
          <thead className="bg-slate-950">
            <tr>
              <th className="sticky left-0 bg-slate-950 px-2 py-2 text-left">
                TM
              </th>
              {data?.weeks.map((week) => (
                <th key={week.id} className="px-2 py-2 text-center">
                  W{week.week_number}
                </th>
              ))}
              <th className="px-2 py-2 text-right">
                {kind === "sudden_death" ? "Strikes" : "Points"}
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.entries.map((poolEntry) => {
              const standing = data.standings.find(
                (item) => item.entryId === poolEntry.id,
              );
              return (
                <tr key={poolEntry.id}>
                  <th className="sticky left-0 border-t border-slate-800 bg-[#111417] px-2 py-2 text-left">
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
                        className="border-t border-slate-800 px-1.5 py-1.5 text-center"
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
                              className="mx-auto size-5 object-contain"
                            />
                          ) : null}
                          {pick?.team ?? "—"}
                        </span>
                        {pick && (
                          <small className="block text-[9px] text-slate-500">
                            {kind === "underdog" && outcome === "win"
                              ? `+${points}`
                              : outcome}
                          </small>
                        )}
                      </td>
                    );
                  })}
                  <td className="border-t border-slate-800 px-3 text-right font-black">
                    {kind === "sudden_death"
                      ? `${standing?.suddenDeathStrikes ?? 0}/2`
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
