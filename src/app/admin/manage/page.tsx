import { PageHeading, PageShell } from "@/components/page-shell";

export default function ManagePoolPage() {
  return (
    <PageShell isCommissioner>
      <PageHeading
        eyebrow="Commissioner"
        title="Rules & messages"
        description="Pool-wide rules and announcements will live here."
      />
      <section className="game-card rounded-xl border p-5">
        <h2 className="font-black">Next after Week 1 launch</h2>
        <p className="mt-2 text-sm text-slate-400">
          The operational tabs—lines, entrants, and picks—are prioritized first.
          Rules publishing and entrant announcements are the remaining admin
          module.
        </p>
      </section>
    </PageShell>
  );
}
