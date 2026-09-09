import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { acceptInvitation } from "./actions";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; error?: string }>;
}) {
  const params = await searchParams;
  if (!params.id) redirect("/login?error=invalid-link");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const { data: invitation } = await supabase
    .from("pool_invitations")
    .select("id, email, phone_e164, status, expires_at")
    .eq("id", params.id)
    .eq("target_user_id", claims.claims.sub)
    .maybeSingle();
  // Request-time expiry validation must remain dynamic.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const valid =
    invitation?.status === "pending" &&
    new Date(invitation.expires_at).getTime() > now;

  return (
    <main className="pick-shell gunmetal grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-100">
      <section className="game-card w-full max-w-md rounded-xl border p-5 shadow-xl">
        <p className="text-xs font-black tracking-[0.18em] text-slate-400">
          HPPP · INVITATION
        </p>
        <h1 className="mt-2 text-2xl font-black">Create your entry</h1>
        {!valid ? (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-amber-950 p-3 text-sm text-amber-200"
          >
            This invitation has expired or is no longer available. Ask the
            commissioner to resend it.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-400">
              Signed in as {invitation.email}. Choose the abbreviation shown
              throughout the pool.
            </p>
            {params.error && (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-amber-950 p-3 text-sm text-amber-200"
              >
                We could not finish enrollment. Check the abbreviation and
                matching passwords of at least 6 characters.
              </p>
            )}
            <form action={acceptInvitation} className="mt-5 grid gap-4">
              <input type="hidden" name="invitation_id" value={invitation.id} />
              <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
                Entry abbreviation
                <input
                  name="entry_code"
                  required
                  minLength={3}
                  maxLength={4}
                  pattern="[A-Za-z]{3,4}"
                  autoCapitalize="characters"
                  className="control-raised min-h-12 rounded-lg border px-3 uppercase text-base"
                  placeholder="HARR"
                />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
                Password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  maxLength={128}
                  autoComplete="new-password"
                  className="control-raised min-h-12 rounded-lg border px-3 text-base normal-case"
                />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
                Confirm password
                <input
                  name="confirmation"
                  type="password"
                  required
                  minLength={6}
                  maxLength={128}
                  autoComplete="new-password"
                  className="control-raised min-h-12 rounded-lg border px-3 text-base normal-case"
                />
              </label>
              <button className="control-pressed min-h-12 rounded-lg border text-sm font-black">
                JOIN POOL
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
