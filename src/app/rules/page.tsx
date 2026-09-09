import { PageHeading, PageShell } from "@/components/page-shell";
import { getPoolContext } from "@/lib/pool-context";

const sections = [
  {
    number: "01",
    title: "Weekly card",
    body: "Choose six teams against the spread and three game totals. Mark one ATS selection as your Best Bet. Also choose one Sudden Death team and one underdog.",
    detail:
      "A missing standard selection is a loss. A missing Best Bet counts as two losses.",
  },
  {
    number: "02",
    title: "Lines & deadlines",
    body: "Everyone uses the same betting-line slate, frozen Thursday at 8:00 PM Eastern. Each selection remains editable until its game kicks off.",
    detail: "Special schedules can use a commissioner-set freeze time.",
  },
  {
    number: "03",
    title: "Visibility",
    body: "Competitors’ selections are hidden until the associated game begins. The weekly grid reveals picks one game at a time at kickoff.",
    detail: "Later-game selections stay private.",
  },
  {
    number: "04",
    title: "Scoring",
    body: "Standard ATS and total wins earn one win. A Best Bet is worth two decisions. Main-pool pushes are ties.",
    detail: "Season rank payouts are configured after enrollment closes.",
  },
  {
    number: "05",
    title: "Sudden Death",
    body: "Pick one outright winner each week. A second loss eliminates you. The contest runs through Week 18, and remaining players split $200.",
    detail: "A simultaneous final-strike wipeout is waived.",
  },
  {
    number: "06",
    title: "Underdog",
    body: "Choose one eligible underdog to win outright each week. Correct picks build your season total; the winner receives $200.",
    detail: "Tied winners split the prize.",
  },
];

export default async function RulesPage() {
  const { supabase, entry, membership, isCommissioner } =
    await getPoolContext();
  const { data: storedSections } = membership
    ? await supabase
        .from("rule_sections")
        .select("section_key, position, title, summary, detail")
        .eq("pool_id", membership.pool_id)
        .order("position")
    : { data: [] };
  const displayedSections = storedSections?.length
    ? storedSections.map((section, index) => ({
        number: String(index + 1).padStart(2, "0"),
        title: section.title,
        body: section.summary,
        detail: section.detail,
      }))
    : sections;
  return (
    <PageShell entryCode={entry?.entry_code} isCommissioner={isCommissioner}>
      <PageHeading eyebrow="" title="Rules" />
      <div className="grid gap-3 md:grid-cols-2">
        {displayedSections.map((section) => (
          <details
            key={section.number}
            open={section.number === "01"}
            className="game-card group rounded-xl border p-5"
          >
            <summary className="flex cursor-pointer list-none items-center gap-4">
              <span className="text-2xl font-black text-slate-700">
                {section.number}
              </span>
              <h2 className="flex-1 text-base font-black">{section.title}</h2>
              <span className="text-slate-500 group-open:rotate-45">+</span>
            </summary>
            <div className="ml-12">
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {section.body}
              </p>
              <p className="mt-3 border-l-2 border-slate-600 pl-3 text-xs leading-5 text-slate-500">
                {section.detail}
              </p>
            </div>
          </details>
        ))}
      </div>
      <section className="game-card mt-4 overflow-hidden rounded-xl border">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-[9px] uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Pool</th>
              <th className="px-4 py-3">Win</th>
              <th className="px-4 py-3">Tie</th>
              <th className="px-4 py-3">Missing</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-800">
              <th className="px-4 py-3">Main</th>
              <td className="px-4 py-3">1 win</td>
              <td className="px-4 py-3">1 tie</td>
              <td className="px-4 py-3">1 loss</td>
            </tr>
            <tr className="border-t border-slate-800">
              <th className="px-4 py-3">Sudden Death</th>
              <td className="px-4 py-3">No strike</td>
              <td className="px-4 py-3">No strike</td>
              <td className="px-4 py-3">1 strike</td>
            </tr>
            <tr className="border-t border-slate-800">
              <th className="px-4 py-3">Underdog</th>
              <td className="px-4 py-3">Spread value</td>
              <td className="px-4 py-3">0 points</td>
              <td className="px-4 py-3">0 points</td>
            </tr>
          </tbody>
        </table>
      </section>
      <p className="mt-5 text-center text-[10px] text-slate-500">
        Commissioner rulings resolve data corrections, postponed games, and
        schedule exceptions.
      </p>
    </PageShell>
  );
}
