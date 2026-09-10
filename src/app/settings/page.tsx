import Link from "next/link";

import { signOut, updateSettings } from "@/app/account/actions";
import { CompactPageHeader } from "@/components/compact-page-header";
import { PageShell } from "@/components/page-shell";
import { PhoneInput } from "@/components/phone-input";
import { ProfilePreferences } from "@/components/profile-preferences";
import { getPoolContext } from "@/lib/pool-context";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    password_saved?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase, entry, email, isCommissioner, userId } =
    await getPoolContext();
  const { data: privateProfile } = await supabase
    .from("profiles")
    .select("phone_e164")
    .eq("id", userId)
    .maybeSingle();

  return (
    <PageShell
      entryCode={entry?.entry_code}
      isCommissioner={isCommissioner}
      compact
    >
      <div className="pb-3 sm:pb-5">
        <CompactPageHeader sticky title="Settings" className="mb-3" />
        <section className="game-card mx-auto max-w-lg rounded-xl border p-4">
          {params.saved && (
            <p className="mb-3 rounded bg-emerald-950 p-2 text-xs text-emerald-200">
              Settings saved.
            </p>
          )}
          {params.password_saved && (
            <p className="mb-3 rounded bg-emerald-950 p-2 text-xs text-emerald-200">
              Password updated.
            </p>
          )}
          {params.error && (
            <p className="mb-3 rounded bg-amber-950 p-2 text-xs text-amber-200">
              Settings could not be saved.
            </p>
          )}
          <form action={updateSettings} className="grid gap-3">
            <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
              Entry name
              <input
                name="entry_code"
                required
                minLength={3}
                maxLength={4}
                pattern="[A-Za-z]{3,4}"
                defaultValue={entry?.entry_code ?? ""}
                className="control-raised min-h-11 rounded-lg border px-3 text-base uppercase"
              />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
              Email
              <input
                name="email"
                type="email"
                required
                defaultValue={email}
                className="control-raised min-h-11 rounded-lg border px-3 text-base normal-case"
              />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
              Phone
              <PhoneInput
                defaultValue={privateProfile?.phone_e164 ?? ""}
                className="control-raised min-h-11 rounded-lg border px-3 text-base normal-case"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button className="control-pressed min-h-11 rounded-lg border text-xs font-black">
                SAVE
              </button>
              <Link
                href="/account/password"
                className="control-raised grid min-h-11 place-items-center rounded-lg border px-2 text-center text-xs font-black"
              >
                UPDATE PASSWORD
              </Link>
            </div>
          </form>
          <div className="my-4 border-t border-slate-800" />
          <ProfilePreferences />
          <form
            action={signOut}
            className="mt-5 border-t border-slate-800 pt-3"
          >
            <button className="text-[10px] font-bold text-red-400 underline decoration-red-800 underline-offset-2">
              SIGN OUT
            </button>
          </form>
        </section>
      </div>
    </PageShell>
  );
}
