import { CompactPageHeader } from "@/components/compact-page-header";
import { PageShell } from "@/components/page-shell";
import { getPoolContext } from "@/lib/pool-context";

const defaults = [
  {
    section_key: "lines_deadlines",
    title: "Deadlines",
    summary:
      "Lines normally freeze Thursday at 8:00 PM ET. Picks lock and become public game by game at kickoff.",
    detail:
      "Standard weeks: All pool lines freeze Thursday at 8:00 PM ET.\nIrregular games: Games before Thursday’s deadline freeze one hour before kickoff.\nPick deadline: Each pick remains editable until that game kicks off.\nVisibility: Other entrants’ picks and Most Picked counts appear only after kickoff.",
  },
  {
    section_key: "weekly_card",
    title: "Main pool",
    summary:
      "Six ATS picks, including one 2× Best Bet, plus three game totals create ten decisions each week.",
    detail:
      "ATS: Choose six teams against the frozen spread.\nBest Bet: Mark one ATS pick; it counts as a second decision.\nO/U: Choose three game totals.\nMissing picks: Every omitted decision is a loss; an omitted Best Bet adds another loss.\nPushes: Main-pool pushes count as ties.",
  },
  {
    section_key: "sudden_death",
    title: "Side pools",
    summary:
      "Sudden Death and Underdog each carry a $200 prize funded evenly by the rest of the pool.",
    detail:
      "Sudden Death: Pick one outright winner weekly. A loss or missing pick earns a strike; two strikes eliminate the entry. An NFL tie adds no strike. A team cannot be reused after its pick locks.\nUnderdog: Pick one eligible underdog to win outright. A win earns points equal to its frozen positive spread; a tie, loss, or missing pick earns zero. Highest season total wins.",
  },
  {
    section_key: "scoring",
    title: "Payouts",
    summary:
      "Main standings use a balanced +$350 to −$350 rank schedule. Side pools and the separate playoff contest settle after the season.",
    detail:
      "Main: Rank payouts are normalized from +$350 to −$350 with the middle of the field at $0; tied entries average occupied rank slots.\nSide pools: SD and UD winners split their $200 pool; all non-winners fund it evenly.\nPlayoffs: Separate 100-point ATS/O/U contest, weighted more heavily by round, with $20 per entry and bonuses for first, second, and third.\nSettlement: Total season exposure can move roughly $400 either way. The commissioner collects and pays after the season by Venmo or Zelle.",
  },
];

const desiredKeys = defaults.map((section) => section.section_key);

function DetailLine({ line }: { line: string }) {
  const [lead, ...rest] = line.split(":");
  return (
    <li>
      <strong className="text-slate-100">{lead}</strong>
      {rest.length ? `: ${rest.join(":").trim()}` : ""}
    </li>
  );
}

export default async function RulesPage() {
  const { supabase, entry, membership, isCommissioner } =
    await getPoolContext();
  const [{ data: storedSections }, { data: payoutRows }] = await Promise.all([
    membership
      ? supabase
          .from("rule_sections")
          .select("section_key, position, title, summary, detail")
          .eq("pool_id", membership.pool_id)
          .in("section_key", desiredKeys)
          .order("position")
      : Promise.resolve({ data: [] }),
    entry
      ? supabase
          .from("payout_schedules")
          .select("amount")
          .eq("season_id", entry.season_id)
      : Promise.resolve({ data: [] }),
  ]);
  const storedMap = new Map(
    (storedSections ?? []).map((section) => [section.section_key, section]),
  );
  const displayedSections = defaults.map(
    (fallback) => storedMap.get(fallback.section_key) ?? fallback,
  );
  const amounts = (payoutRows ?? []).map((row) => Number(row.amount));
  const payoutRange = amounts.length
    ? `${formatMoney(Math.max(...amounts))} to ${formatMoney(Math.min(...amounts))}`
    : "+$350 to −$350";

  return (
    <PageShell
      entryCode={entry?.entry_code}
      isCommissioner={isCommissioner}
      compact
    >
      <div className="py-3 sm:py-5">
        <CompactPageHeader title="Rules" className="mb-3" />
        <div className="space-y-2">
          {displayedSections.map((section, index) => (
            <details
              key={section.section_key}
              open={index === 0}
              className="game-card group overflow-hidden rounded-xl border"
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 py-2">
                <span className="grid size-6 shrink-0 place-items-center rounded bg-slate-800 text-[9px] font-black text-slate-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-black">{section.title}</h2>
                  <p className="mt-0.5 text-[10px] leading-4 text-slate-400">
                    {section.summary}
                  </p>
                </div>
                <span className="text-lg text-slate-500 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="border-t border-slate-800 px-3 py-3">
                {section.section_key === "lines_deadlines" && (
                  <table className="mb-3 w-full text-left text-[10px]">
                    <thead className="text-[8px] uppercase text-slate-500">
                      <tr>
                        <th className="pb-1">Item</th>
                        <th className="pb-1">Lock</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-800">
                        <th className="py-1.5">Standard lines</th>
                        <td>Thu 8 PM ET</td>
                      </tr>
                      <tr className="border-t border-slate-800">
                        <th className="py-1.5">Early/irregular game</th>
                        <td>1 hr before kickoff</td>
                      </tr>
                      <tr className="border-t border-slate-800">
                        <th className="py-1.5">Each pick</th>
                        <td>Game kickoff</td>
                      </tr>
                    </tbody>
                  </table>
                )}
                {section.section_key === "weekly_card" && (
                  <table className="mb-3 w-full text-left text-[10px]">
                    <thead className="text-[8px] uppercase text-slate-500">
                      <tr>
                        <th className="pb-1">Pick</th>
                        <th className="pb-1">Weekly</th>
                        <th className="pb-1">Decisions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["ATS", "6", "6"],
                        ["Best Bet", "1 of 6 ATS", "+1"],
                        ["O/U", "3", "3"],
                        ["Total", "9 picks", "10"],
                      ].map((row) => (
                        <tr
                          key={row[0]}
                          className="border-t border-slate-800 last:font-black"
                        >
                          <th className="py-1.5">{row[0]}</th>
                          <td>{row[1]}</td>
                          <td>{row[2]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {section.section_key === "scoring" && (
                  <p className="mb-3 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-[10px]">
                    Current Main schedule: <strong>{payoutRange}</strong>
                  </p>
                )}
                <ul className="space-y-1.5 text-xs leading-5 text-slate-400">
                  {section.detail
                    .split("\n")
                    .filter(Boolean)
                    .map((line: string) => (
                      <DetailLine key={line} line={line} />
                    ))}
                </ul>
              </div>
            </details>
          ))}
        </div>
        <p className="mt-3 text-center text-[9px] text-slate-500">
          Commissioner rulings resolve corrections, postponements, and unusual
          schedule conditions.
        </p>
      </div>
    </PageShell>
  );
}

function formatMoney(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}$${Math.abs(value).toFixed(value % 1 ? 2 : 0)}`;
}
