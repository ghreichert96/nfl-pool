import { PageShell } from "@/components/page-shell";
import { requireCommissioner } from "@/lib/admin";
import { PayoutScaleEditor } from "../payout-scale-editor";
import { saveSidePots, saveSdContest } from "./actions";
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
  const { data: contests, error: contestError } = await supabase
    .from("sd_contests")
    .select("id,number,start_week,end_week,strike_limit,pot")
    .eq("season_id", season.id)
    .order("number");
  if (contestError) throw contestError;
  const { data: seasonWeeks } = await supabase
    .from("pool_weeks")
    .select("id,week_number,games(kickoff_at)")
    .eq("season_id", season.id);
  const locked = (c: { start_week: number; end_week: number }) =>
    (seasonWeeks ?? []).some(
      (w) =>
        w.week_number >= c.start_week &&
        w.week_number <= c.end_week &&
        w.games.some((g) => Date.parse(g.kickoff_at) <= Date.now()),
    );
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
          Settings could not be saved. SD settings lock at the first kickoff.
          Check the values and retry.
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
              ["sd_pot", "SD1"],
              ["ud_pot", "Underdog"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="grid gap-1 text-sm">
              {label}
              <input
                readOnly={key === "sd_pot" && !!contests?.length}
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
      {(contests ?? []).map((c) => (
        <form
          key={c.id}
          action={saveSdContest}
          className="game-card mt-3 grid gap-3 rounded-lg border p-3"
        >
          <input type="hidden" name="contest_id" value={c.id} />
          <h2 className="font-bold">
            SD{c.number} · Weeks {c.start_week}–{c.end_week}
          </h2>
          <p className="text-xs text-slate-400">
            {locked(c)
              ? "Settings locked at the first kickoff."
              : "Settings can be changed until the first kickoff."}
          </p>
          <fieldset
            disabled={locked(c)}
            className="grid grid-cols-2 gap-3 disabled:opacity-60"
          >
            <label className="grid gap-1 text-sm">
              Strikes
              <select
                name="strike_limit"
                defaultValue={c.strike_limit}
                className="control-raised min-h-10 rounded border px-2"
              >
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Payout
              <input
                name="pot"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                required
                defaultValue={Number(c.pot)}
                className="control-raised min-h-10 w-full rounded border px-2"
              />
            </label>
            {!locked(c) && (
              <button className="admin-button col-span-2 justify-self-end">
                Save SD{c.number}
              </button>
            )}
          </fieldset>
        </form>
      ))}
    </PageShell>
  );
}
