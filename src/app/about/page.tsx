import { PageHeading, PageShell } from "@/components/page-shell";
import { getPoolContext } from "@/lib/pool-context";
export default async function AboutPage() {
  const { entry, isCommissioner } = await getPoolContext();
  return (
    <PageShell entryCode={entry?.entry_code} isCommissioner={isCommissioner}>
      <PageHeading
        eyebrow="Est. Fall 2024"
        title="About the pool"
        description="An independent, commissioner-run football picks pool."
      />
      <section className="game-card rounded-xl border p-5 text-sm leading-6 text-slate-300">
        <p>
          This pool is inspired by a spreads pool of Virginia dads, the Cville
          16. It’s designed to give entrants a way to stay entertained and a
          fair shot to win—against each other—without losing money to Vegas.
        </p>
        <p className="mt-3">
          The 2024 and 2025 seasons ran out of Google Forms and Google Sheets.
          Code for the 2026 pool site was developed and is maintained by a
          development team in Bangalore, India.
        </p>
        <p className="mt-3">
          Contact Harry (pool commish) at{" "}
          <a
            className="font-bold text-cyan-300 underline"
            href="tel:+14344090768"
          >
            +1 (434) 409-0768
          </a>{" "}
          or{" "}
          <a
            className="font-bold text-cyan-300 underline"
            href="mailto:ghreichert96@gmail.com"
          >
            ghreichert96@gmail.com
          </a>{" "}
          for any questions, concerns, or feedback.
        </p>
        <p className="mt-4 text-xs text-slate-500">HPPP · 2026 MVP</p>
      </section>
    </PageShell>
  );
}
