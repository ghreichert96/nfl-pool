import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { inviteEntry } from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
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

  return (
    <main className="pick-shell gunmetal mx-auto min-h-screen max-w-2xl bg-slate-950 px-4 py-8 text-slate-100">
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
    </main>
  );
}
