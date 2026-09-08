import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeading, PageShell } from "@/components/page-shell";
import { createClient } from "@/lib/supabase/server";
import { TEST_LAB_STAGES, testLabEnabled } from "@/lib/test-lab";

import { deleteTestLab, resetTestLab, setTestLabStage } from "./actions";

export const dynamic = "force-dynamic";

export default async function TestLabPage() {
  if (!testLabEnabled()) redirect("/admin");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: membership } = await supabase
    .from("pool_memberships")
    .select("pool_id")
    .eq("user_id", claims.claims.sub)
    .eq("role", "commissioner")
    .maybeSingle();
  if (!membership) redirect("/");
  const { data: state } = await supabase
    .from("test_lab_states")
    .select("week_id, stage, updated_at")
    .eq("pool_id", membership.pool_id)
    .maybeSingle();
  const { count: entries } = state
    ? await supabase
        .from("pool_entries")
        .select("id", { count: "exact", head: true })
        .eq("is_test", true)
    : { count: 0 };

  return (
    <PageShell isCommissioner>
      <PageHeading
        eyebrow="Commissioner · local testing"
        title="Week simulator"
        description="Exercise real locking, visibility, scoring, and standings against isolated synthetic data."
        action={
          <Link
            href="/admin"
            className="control-raised rounded-md border px-3 py-2 text-xs font-black"
          >
            BACK
          </Link>
        }
      />
      <section className="mb-4 rounded-xl border border-amber-700 bg-amber-950/40 p-4 text-xs leading-5 text-amber-100">
        <strong>Test fixture only.</strong> Reset creates synthetic entries
        inside the active local season. Delete removes every marked test entry,
        submission, pick, comment, game, and fixture account.
      </section>
      {!state ? (
        <section className="game-card rounded-xl border p-6 text-center">
          <h2 className="text-lg font-black">No simulation loaded</h2>
          <p className="mt-2 text-sm text-slate-400">
            Create 13 entries, eight games, frozen lines, picks, and comments.
          </p>
          <form action={resetTestLab} className="mt-5">
            <button className="control-pressed min-h-11 rounded-lg border px-5 text-sm font-black">
              CREATE TEST WEEK
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="mb-4 grid grid-cols-3 gap-2">
            <div className="game-card rounded-lg border p-3">
              <small className="text-slate-500">Stage</small>
              <strong className="mt-1 block text-sm">
                {TEST_LAB_STAGES.find(([value]) => value === state.stage)?.[1]}
              </strong>
            </div>
            <div className="game-card rounded-lg border p-3">
              <small className="text-slate-500">Test entries</small>
              <strong className="mt-1 block text-sm">{entries ?? 0}</strong>
            </div>
            <div className="game-card rounded-lg border p-3">
              <small className="text-slate-500">Updated</small>
              <strong className="mt-1 block text-sm">
                {new Date(state.updated_at).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </strong>
            </div>
          </section>
          <section className="game-card rounded-xl border p-4">
            <h2 className="font-black">Advance the week</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {TEST_LAB_STAGES.map(([value, label], index) => (
                <form key={value} action={setTestLabStage}>
                  <input type="hidden" name="stage" value={value} />
                  <button
                    className={`min-h-14 w-full rounded-lg border px-3 text-left text-xs font-black ${state.stage === value ? "control-pressed" : "control-raised"}`}
                  >
                    <span className="mr-2 text-slate-500">{index + 1}</span>
                    {label}
                  </button>
                </form>
              ))}
            </div>
          </section>
          <section className="mt-4 grid grid-cols-3 gap-2">
            <Link
              href="/"
              className="control-raised grid min-h-12 place-items-center rounded-lg border text-xs font-black"
            >
              PICKS
            </Link>
            <Link
              href="/grid"
              className="control-raised grid min-h-12 place-items-center rounded-lg border text-xs font-black"
            >
              GRID
            </Link>
            <Link
              href="/standings"
              className="control-raised grid min-h-12 place-items-center rounded-lg border text-xs font-black"
            >
              STANDINGS
            </Link>
          </section>
          <div className="mt-6 flex gap-2">
            <form action={resetTestLab}>
              <button className="control-raised min-h-10 rounded-lg border px-4 text-xs font-black">
                RESET FIXTURE
              </button>
            </form>
            <form action={deleteTestLab} className="ml-auto">
              <button className="min-h-10 rounded-lg border border-red-800 bg-red-950 px-4 text-xs font-black text-red-300">
                DELETE TEST DATA
              </button>
            </form>
          </div>
        </>
      )}
    </PageShell>
  );
}
