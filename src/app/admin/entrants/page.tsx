import { PageHeading, PageShell } from "@/components/page-shell";
import { requireCommissioner } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  resendInvitation,
  sendMagicLink,
  sendPasswordReset,
  updateEntrantCode,
} from "./actions";
import { revokeInvitation } from "../actions";
import { RecoveryLinkButton } from "./recovery-link-button";

export const dynamic = "force-dynamic";

export default async function EntrantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { supabase, poolId } = await requireCommissioner();
  const { data: season } = await supabase
    .from("seasons")
    .select("id, year")
    .eq("pool_id", poolId)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: entries } = season
    ? await supabase
        .from("pool_entries")
        .select("id, entry_code, user_id")
        .eq("season_id", season.id)
        .order("entry_code")
    : { data: [] };
  const { data: invitations } = season
    ? await supabase
        .from("pool_invitations")
        .select("id, email, phone_e164, status, expires_at")
        .eq("season_id", season.id)
        .order("created_at", { ascending: false })
    : { data: [] };
  const admin = createAdminClient();
  const { data: usersPage } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const users = new Map(usersPage.users.map((user) => [user.id, user]));
  const notice = params.magic_sent
    ? "Magic link sent."
    : params.reset_sent
      ? "Password reset sent."
      : null;

  return (
    <PageShell isCommissioner>
      <PageHeading
        eyebrow={`Commissioner · ${season?.year ?? "Season"}`}
        title="Entrants"
        description="Entry names, account state, and authentication recovery. Passwords are one-way hashes and cannot be displayed."
      />
      {notice && (
        <p className="mb-4 rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200">
          {notice}
        </p>
      )}
      {params.error && (
        <p className="mb-4 rounded-lg bg-red-950 p-3 text-sm text-red-200">
          Email action failed. Check the auth email logs.
        </p>
      )}
      {(invitations ?? []).some((item) => item.status === "pending") && (
        <section className="mb-5 rounded-xl border border-slate-800 p-4">
          <h2 className="font-black">Pending invitations</h2>
          <div className="mt-3 grid gap-2">
            {invitations!
              .filter((item) => item.status === "pending")
              .map((item) => (
                <div
                  key={item.id}
                  className="game-card grid gap-2 rounded-lg border p-3 text-xs sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <strong>{item.email}</strong>
                    <span className="ml-2 text-slate-500">
                      {item.phone_e164} · expires{" "}
                      {new Date(item.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <form action={resendInvitation}>
                      <input
                        type="hidden"
                        name="invitation_id"
                        value={item.id}
                      />
                      <button className="control-raised rounded border px-2 py-1 font-black">
                        RESEND
                      </button>
                    </form>
                    <form action={revokeInvitation}>
                      <input
                        type="hidden"
                        name="invitation_id"
                        value={item.id}
                      />
                      <button className="control-raised rounded border px-2 py-1 font-black">
                        REVOKE
                      </button>
                    </form>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
      <section className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="p-3">Entry</th>
              <th className="p-3">Email</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last sign-in</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {(entries ?? []).map((entry) => {
              const user = users.get(entry.user_id);
              return (
                <tr key={entry.id} className="game-card">
                  <td className="p-3">
                    <form action={updateEntrantCode} className="flex gap-1">
                      <input type="hidden" name="entry_id" value={entry.id} />
                      <input
                        name="entry_code"
                        defaultValue={entry.entry_code}
                        minLength={3}
                        maxLength={4}
                        pattern="[A-Za-z]{3,4}"
                        className="control-raised w-16 rounded border px-2 py-1 font-black uppercase"
                      />
                      <button
                        aria-label={`Save ${entry.entry_code} abbreviation`}
                        className="control-raised rounded border px-2"
                      >
                        ✓
                      </button>
                    </form>
                  </td>
                  <td className="p-3">{user?.email ?? "No auth account"}</td>
                  <td className="p-3 text-xs text-slate-400">
                    {user?.email_confirmed_at ? "Confirmed" : "Unconfirmed"}
                  </td>
                  <td className="p-3 text-xs text-slate-400">
                    {user?.last_sign_in_at
                      ? new Date(user.last_sign_in_at).toLocaleString("en-US", {
                          timeZone: "America/New_York",
                        })
                      : "Never"}
                  </td>
                  <td className="p-3">
                    {user && (
                      <div className="flex gap-2">
                        <form action={sendMagicLink}>
                          <input type="hidden" name="user_id" value={user.id} />
                          <button className="control-raised rounded-md border px-3 py-2 text-xs font-black">
                            MAGIC LINK
                          </button>
                        </form>
                        <form action={sendPasswordReset}>
                          <input type="hidden" name="user_id" value={user.id} />
                          <button className="control-raised rounded-md border px-3 py-2 text-xs font-black">
                            RESET PASSWORD
                          </button>
                        </form>
                        <RecoveryLinkButton userId={user.id} />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </PageShell>
  );
}
