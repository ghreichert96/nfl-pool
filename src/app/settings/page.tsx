import Link from "next/link";
import { CompactPageHeader } from "@/components/compact-page-header";
import { PageShell } from "@/components/page-shell";
import { PhoneInput } from "@/components/phone-input";
import { getPoolContext } from "@/lib/pool-context";
import { updateSettings } from "@/app/account/actions";
import { ThemeSelector } from "@/components/theme-controls";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { supabase, entry, email, isCommissioner, userId } =
    await getPoolContext();
  const params = await searchParams;
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
        <section className="game-card mx-auto max-w-lg rounded-xl border p-5">
          {params.saved && (
            <p
              role="status"
              className="mb-4 rounded bg-emerald-950 p-3 text-sm text-emerald-200"
            >
              Settings saved. Email changes may require confirmation.
            </p>
          )}
          {params.error && (
            <p
              role="alert"
              className="mb-4 rounded bg-amber-950 p-3 text-sm text-amber-200"
            >
              {params.error === "email"
                ? "Entry settings saved, but the email change could not be started."
                : "Settings could not be saved. The entry name may already be in use."}
            </p>
          )}
          <form action={updateSettings} className="grid gap-4">
            <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
              Entry name
              <input
                name="entry_code"
                required
                minLength={3}
                maxLength={4}
                pattern="[A-Za-z]{3,4}"
                defaultValue={entry?.entry_code ?? ""}
                className="control-raised min-h-12 rounded-lg border px-3 text-base uppercase"
              />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
              Email
              <input
                name="email"
                type="email"
                required
                defaultValue={email}
                className="control-raised min-h-12 rounded-lg border px-3 text-base normal-case"
              />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-400">
              Phone
              <PhoneInput
                defaultValue={privateProfile?.phone_e164 ?? ""}
                className="control-raised min-h-12 rounded-lg border px-3 text-base normal-case"
              />
            </label>
            <button className="control-pressed min-h-12 rounded-lg border text-sm font-black">
              SAVE SETTINGS
            </button>
          </form>
          <div className="my-4 border-t border-slate-800" />
          <ThemeSelector />
          <Link
            href="/account/password"
            className="control-raised mt-3 grid min-h-12 place-items-center rounded-lg border text-sm font-black"
          >
            CHANGE PASSWORD
          </Link>
        </section>
      </div>
    </PageShell>
  );
}
