import { redirect } from "next/navigation";

import { PageHeading, PageShell } from "@/components/page-shell";
import { createClient } from "@/lib/supabase/server";

import { inviteEntry, saveGame } from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: string;
    error?: string;
    game_saved?: string;
    game_error?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");

  const { data: commissioner } = await supabase
    .from("pool_memberships")
    .select("pool_id")
    .eq("user_id", claims.claims.sub)
    .eq("role", "commissioner")
    .maybeSingle();

  if (!commissioner) redirect("/");

  const params = await searchParams;
  const [{ count: entrantCount }, { data: season }] = await Promise.all([
    supabase
      .from("pool_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("pool_id", commissioner.pool_id),
    supabase
      .from("seasons")
      .select("id, year, status")
      .eq("pool_id", commissioner.pool_id)
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return (
    <PageShell isCommissioner>
      <PageHeading
        eyebrow="Commissioner tools"
        title="Admin pane"
        description="Manage the active season, weekly slate, frozen lines, and entrants."
      />
      <section className="mb-5 grid grid-cols-3 gap-2">
        <div className="game-card rounded-lg border p-3">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Season
          </span>
          <strong className="mt-1 block text-lg">{season?.year ?? "—"}</strong>
        </div>
        <div className="game-card rounded-lg border p-3">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Entrants
          </span>
          <strong className="mt-1 block text-lg">{entrantCount ?? 0}</strong>
        </div>
        <div className="game-card rounded-lg border p-3">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Status
          </span>
          <strong className="mt-1 block text-lg capitalize">
            {season?.status ?? "Setup"}
          </strong>
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="game-card mx-auto max-w-md rounded-xl border p-5 shadow-xl">
          <p className="text-xs font-black tracking-[0.18em] text-slate-300">
            HPPP · WEEKLY SETUP
          </p>
          <h1 className="mt-2 text-xl font-black">Add a game and line</h1>
          <p className="mt-2 text-sm text-slate-400">
            Times are entered in Eastern Time. Adding the first game creates the
            week.
          </p>
          {params.game_saved ? (
            <p className="mt-4 rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200">
              Game and line saved.
            </p>
          ) : null}
          {params.game_error ? (
            <p className="mt-4 rounded-lg bg-amber-950 p-3 text-sm text-amber-200">
              The game could not be saved. Check every value and try again.
            </p>
          ) : null}
          <form action={saveGame} className="mt-5 grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm font-bold">
              Week
              <input
                name="week_number"
                type="number"
                min="1"
                max="22"
                defaultValue="1"
                required
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Line freeze (ET)
              <input
                name="freeze_at"
                type="datetime-local"
                required
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Away
              <input
                name="away_team"
                required
                maxLength={3}
                placeholder="DAL"
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3 uppercase"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Home
              <input
                name="home_team"
                required
                maxLength={3}
                placeholder="PHI"
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3 uppercase"
              />
            </label>
            <label className="col-span-2 grid gap-1 text-sm font-bold">
              Kickoff (ET)
              <input
                name="kickoff_at"
                type="datetime-local"
                required
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Away spread
              <input
                name="away_spread"
                type="number"
                step="0.5"
                required
                placeholder="-3.5"
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Total
              <input
                name="total"
                type="number"
                step="0.5"
                min="1"
                required
                placeholder="47.5"
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Window
              <select
                name="game_type"
                defaultValue="sunday"
                className="control-raised min-h-11 rounded-lg border bg-slate-950 px-3"
              >
                <option value="tnf">TNF</option>
                <option value="international">International</option>
                <option value="sunday">Sunday</option>
                <option value="snf">SNF</option>
                <option value="mnf">MNF</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Venue
              <input
                name="venue"
                maxLength={120}
                placeholder="Optional"
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3"
              />
            </label>
            <button
              type="submit"
              className="control-raised col-span-2 mt-2 min-h-11 rounded-lg border bg-emerald-600 font-black text-white"
            >
              SAVE GAME
            </button>
          </form>
        </section>
        <section className="game-card mx-auto max-w-md rounded-xl border p-5 shadow-xl">
          <p className="text-xs font-black tracking-[0.18em] text-slate-300">
            HPPP · COMMISSIONER
          </p>
          <h1 className="mt-2 text-xl font-black">Invite an entrant</h1>
          <p className="mt-2 text-sm text-slate-400">
            The entrant receives a passwordless sign-in email and is enrolled
            under the entry code you provide.
          </p>
          {params.sent ? (
            <p className="mt-4 rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200">
              Invitation sent.
            </p>
          ) : null}
          {params.error ? (
            <p className="mt-4 rounded-lg bg-amber-950 p-3 text-sm text-amber-200">
              We could not create that invitation. Check the email and entry
              code, then try again.
            </p>
          ) : null}
          <form action={inviteEntry} className="mt-5 grid gap-3">
            <label className="grid gap-1 text-sm font-bold">
              Email
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3"
                placeholder="entrant@example.com"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Entry code
              <input
                name="entry_code"
                required
                minLength={3}
                maxLength={4}
                pattern="[A-Za-z]{3,4}"
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3 uppercase"
                placeholder="HARR"
              />
            </label>
            <button
              type="submit"
              className="control-raised mt-2 min-h-11 rounded-lg border bg-emerald-600 font-black text-white"
            >
              SEND INVITATION
            </button>
          </form>
        </section>
      </div>
    </PageShell>
  );
}
