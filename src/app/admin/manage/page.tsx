import { PageHeading, PageShell } from "@/components/page-shell";
import { requireCommissioner } from "@/lib/admin";
import { saveRuleSection } from "./actions";
import { PublishButton } from "./publish-button";

export default async function ManagePoolPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { supabase, poolId } = await requireCommissioner();
  const params = await searchParams;
  const { data: sections } = await supabase
    .from("rule_sections")
    .select("id, position, title, summary, detail, revision")
    .eq("pool_id", poolId)
    .order("position");
  return (
    <PageShell isCommissioner>
      <PageHeading
        eyebrow="Commissioner"
        title="Rules"
        description="Small copy edits publish immediately. Scoring mechanics remain code-controlled."
      />
      {params.saved && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200"
        >
          Rule published.
        </p>
      )}
      {params.error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-amber-950 p-3 text-sm text-amber-200"
        >
          Rule could not be saved.
        </p>
      )}
      <div className="grid gap-4">
        {(sections ?? []).map((section) => (
          <form
            key={section.id}
            action={saveRuleSection}
            className="game-card grid gap-3 rounded-xl border p-5"
          >
            <input type="hidden" name="id" value={section.id} />
            <div className="flex justify-between">
              <strong>Section {section.position}</strong>
              <small className="text-slate-500">
                Revision {section.revision}
              </small>
            </div>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
              Title
              <input
                name="title"
                required
                maxLength={80}
                defaultValue={section.title}
                className="control-raised min-h-11 rounded-lg border px-3 text-base normal-case"
              />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
              Summary
              <textarea
                name="summary"
                required
                maxLength={600}
                defaultValue={section.summary}
                rows={3}
                className="control-raised rounded-lg border p-3 text-sm normal-case"
              />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
              Detail
              <textarea
                name="detail"
                maxLength={600}
                defaultValue={section.detail}
                rows={2}
                className="control-raised rounded-lg border p-3 text-sm normal-case"
              />
            </label>
            <PublishButton />
          </form>
        ))}
      </div>
    </PageShell>
  );
}
