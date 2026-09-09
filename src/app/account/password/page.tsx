import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeading, PageShell } from "@/components/page-shell";
import { createClient } from "@/lib/supabase/server";

import { setPassword } from "./actions";

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");
  const params = await searchParams;

  return (
    <PageShell>
      <PageHeading
        eyebrow="Account security"
        title="Set or change password"
        description="Passwordless sign-in will remain available after you create a password."
      />
      <section className="game-card mx-auto max-w-md rounded-xl border p-5 shadow-xl">
        {params.error && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-amber-800 bg-amber-950 p-3 text-sm text-amber-200"
          >
            {params.error === "invalid"
              ? "Use matching passwords of at least 6 characters."
              : "The password could not be updated. Request a new recovery link and try again."}
          </p>
        )}
        <form action={setPassword} className="grid gap-4">
          <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-400">
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              maxLength={128}
              required
              className="control-raised min-h-12 rounded-lg border px-3 text-base normal-case tracking-normal text-slate-100"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-400">
            Confirm password
            <input
              name="confirmation"
              type="password"
              autoComplete="new-password"
              minLength={6}
              maxLength={128}
              required
              className="control-raised min-h-12 rounded-lg border px-3 text-base normal-case tracking-normal text-slate-100"
            />
          </label>
          <button className="control-pressed min-h-12 rounded-lg border text-sm font-black">
            SAVE PASSWORD
          </button>
        </form>
        <Link
          href="/account"
          className="mt-4 block text-center text-xs text-slate-400 underline"
        >
          Cancel
        </Link>
      </section>
    </PageShell>
  );
}
