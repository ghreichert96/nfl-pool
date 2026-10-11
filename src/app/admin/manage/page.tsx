import { PageShell } from "@/components/page-shell";
import { requireCommissioner } from "@/lib/admin";
import { PayoutScaleEditor } from "../payout-scale-editor";
import { saveSidePots } from "./actions";
export default async function ManagePoolPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { supabase, poolId } = await requireCommissioner();
  const { data: season, error } = await supabase
    .from("seasons")
    .select("id,year,sd_pot,ud_pot")
    .eq("pool_id", poolId)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!season)
    return <PageShell isCommissioner>No season configured.</PageShell>;
  const [{ count }, { data: payouts }] = await Promise.all([
    supabase
      .from("pool_entries")
      .select("id", { count: "exact", head: true })
      .eq("season_id", season.id)
      .eq("is_test", false),
    supabase
      .from("payout_schedules")
      .select("amount")
      .eq("season_id", season.id),
  ]);
  return (
    <PageShell isCommissioner>
      <h1 className="mb-3 font-black">Rules & payouts · {season.year}</h1>
      {(params.saved || params.payout_saved) && (
        <p role="status" className="mb-3 text-sm">
          Payouts saved.
        </p>
      )}
      {(params.error || params.payout_error) && (
        <p role="alert" className="mb-3 text-sm text-red-400">
          Payouts could not be saved. Check the values and retry.
        </p>
      )}
      <section className="game-card mb-3 rounded-lg border p-3">
        <h2 className="font-bold">Main pool</h2>
        {(count ?? 0) >= 2 ? (
          <PayoutScaleEditor
            seasonId={season.id}
            entryCount={count ?? 0}
            currentMaximum={Math.max(
              0,
              ...(payouts ?? []).map((p) => Number(p.amount)),
            )}
          />
        ) : (
          <p className="text-sm">
            At least two competitive entries are required.
          </p>
        )}
      </section>
      <form
        action={saveSidePots}
        className="game-card grid gap-3 rounded-lg border p-3"
      >
        <input type="hidden" name="season_id" value={season.id} />
        <h2 className="font-bold">Side pools</h2>
        <p className="text-xs text-slate-400">
          Each amount is the combined payout, shared among winners and funded
          equally by losing entries. Everyone tied means no payment.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["sd_pot", "Sudden Death"],
              ["ud_pot", "Underdog"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="grid gap-1 text-sm">
              {label}
              <input
                name={key}
                type="number"
                min="0"
                max="100000"
                step="0.01"
                required
                defaultValue={Number(season[key])}
                className="control-raised min-h-10 w-full rounded border px-2"
              />
            </label>
          ))}
        </div>
        <button className="admin-button justify-self-end">Save payouts</button>
      </form>
    </PageShell>
  );
}
