import { PageHeading, PageShell } from "@/components/page-shell";
import { getPoolContext } from "@/lib/pool-context";
export default async function AboutPage() {
  const { entry, isCommissioner } = await getPoolContext();
  return (
    <PageShell entryCode={entry?.entry_code} isCommissioner={isCommissioner}>
      <PageHeading
        eyebrow="HPPP · 2026"
        title="About the pool"
        description="A private, commissioner-run NFL picks pool."
      />
      <section className="game-card rounded-xl border p-5 text-sm leading-6 text-slate-300">
        <p>
          HPPP combines weekly ATS and totals picks with season-long Underdog
          and Sudden Death contests.
        </p>
        <p className="mt-3">
          For account, invitation, or scoring help, contact the commissioner
          through the private contact information used for your invitation.
        </p>
        <p className="mt-4 text-xs text-slate-500">2026 MVP</p>
      </section>
    </PageShell>
  );
}
