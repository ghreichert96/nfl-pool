import { CompactPageHeader } from "@/components/compact-page-header";
import { PageShell } from "@/components/page-shell";
import { getPoolContext } from "@/lib/pool-context";

const defaults = [
  {
    section_key: "lines_deadlines",
    title: "Deadlines",
    summary: "Line freeze, pick lock, and public reveal times.",
    detail:
      "Standard lines: Thu 8 PM ET\nEarly/irregular games: 1 hour before kickoff\nPicks: Game kickoff\nVisibility: Picks and Most Picked reveal after kickoff",
  },
  {
    section_key: "weekly_card",
    title: "Main pool",
    summary: "6 ATS + 3 O/U = 10 weekly decisions.",
    detail:
      "ATS: 6 picks against the frozen spread\nBest Bet: 1 ATS pick counts twice\nO/U: 3 game totals\nMissing: Loss for each empty decision\nPush: Tie",
  },
  {
    section_key: "sudden_death",
    title: "Side pools",
    summary: "Sudden Death and Underdog · $200 each.",
    detail:
      "Sudden Death: 1 outright winner weekly; 2 strikes eliminates\nSD loss/missing: 1 strike\nSD tie: No strike\nSD reuse: Team unavailable after lock\nUnderdog: Outright win earns frozen positive spread\nUD tie/loss/missing: 0 points",
  },
  {
    section_key: "scoring",
    title: "Payouts",
    summary: "Main ±$350 · Side pools $200 · Playoffs $20/entry.",
    detail:
      "Main: +$350 to −$350; middle rank $0\nTies: Average occupied rank slots\nSD / UD: $200 each; funded evenly by non-winners\nPlayoffs: 100 points; $20/entry; 1st/2nd/3rd paid\nSettlement: After season via Venmo or Zelle",
  },
];

export default async function RulesPage() {
  const { supabase, entry, isCommissioner } = await getPoolContext();
  const [{ data: payoutRows }, { data: season }, { data: contests }] =
    await Promise.all([
      entry
        ? supabase
            .from("payout_schedules")
            .select("amount")
            .eq("season_id", entry.season_id)
        : Promise.resolve({ data: [] }),
      entry
        ? supabase
            .from("seasons")
            .select("sd_pot,ud_pot")
            .eq("id", entry.season_id)
            .single()
        : Promise.resolve({ data: null }),
      entry
        ? supabase
            .from("sd_contests")
            .select("number,start_week,strike_limit,pot")
            .eq("season_id", entry.season_id)
            .order("number")
        : Promise.resolve({ data: [] }),
    ]);
  const sd2 = contests?.find((c) => c.number === 2);
  const sd = Number(season?.sd_pot ?? 225);
  const ud = Number(season?.ud_pot ?? 225);
  const amounts = (payoutRows ?? []).map((row) => Number(row.amount));
  const payoutRange = amounts.length
    ? `${formatMoney(Math.max(...amounts))} to ${formatMoney(Math.min(...amounts))}`
    : "+$350 to −$350";

  const displayedSections = defaults.map((section) => {
    if (section.section_key === "sudden_death")
      return {
        ...section,
        title: "SD1, SD2 and UD",
        summary: `SD1 $${sd} · SD2 $${sd2?.pot ?? 225} · UD $${ud}.`,
        detail: `SD1: Complete through Week 7; results and payouts preserved\nSD2: Starts Week ${sd2?.start_week ?? 8}; all existing entries; fresh strikes and all teams available\nSD2 strikes: ${sd2?.strike_limit ?? 2} strikes eliminates\nSD pick: One outright winner each week; locks at game kickoff\nSD loss/missing: One strike; tie adds none\nSD reuse: No team reuse within the same contest; SD1 teams may be used in SD2\nField reprieve: If everyone remaining would be eliminated, no strikes that week\nCompletion: Last survivor after a final weekly slate wins; multiple survivors after Week 18 split\nSD2 funding: Winners share $${sd2?.pot ?? 225}; non-winners share the cost; everyone tied pays $0\nUD: Outright win earns frozen positive spread; tie/loss/missing earns 0`,
      };
    if (section.section_key === "scoring")
      return {
        ...section,
        summary: `Main ${payoutRange} · SD1 $${sd} · SD2 $${sd2?.pot ?? 225} · UD $${ud}.`,
        detail: `Main: ${payoutRange}\nTies: Average occupied rank slots\nSD1: $${sd} combined; final after Week 7\nSD2: $${sd2?.pot ?? 225} combined; split among winners\nUnderdog: $${ud} combined; split among winners\nSide pool costs: Shared evenly by non-winners; everyone tied pays $0\nPlayoffs: 100 points; $20/entry; 1st/2nd/3rd paid\nSettlement: After season via Venmo or Zelle`,
      };
    return section;
  });

  return (
    <PageShell
      entryCode={entry?.entry_code}
      isCommissioner={isCommissioner}
      compact
    >
      <div className="pb-3 sm:pb-5">
        <CompactPageHeader sticky title="Rules" className="mb-3" />
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
                  <p className="mt-0.5 text-xs leading-4 text-slate-300">
                    {section.summary}
                  </p>
                </div>
                <span className="text-lg text-slate-500 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="border-t border-slate-800 px-3 py-3">
                {section.section_key === "scoring" && (
                  <p className="mb-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-slate-200">
                    Current Main scale: <strong>{payoutRange}</strong>
                  </p>
                )}
                <table className="pool-table w-full table-fixed text-left text-sm text-slate-200">
                  <tbody>
                    {section.detail
                      .split("\n")
                      .filter(Boolean)
                      .map((line: string) => {
                        const [label, ...detail] = line.split(":");
                        return (
                          <tr key={line} className="border-t border-slate-800">
                            <th className="w-[42%] py-2 pr-2 align-top text-xs font-black text-slate-100">
                              {label}
                            </th>
                            <td className="py-2 align-top">
                              {detail.join(":").trim()}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
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
