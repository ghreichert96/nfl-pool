import Link from "next/link";

import { signUp } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="pick-shell gunmetal mx-auto grid min-h-screen max-w-2xl place-items-center bg-slate-950 px-4 text-slate-100">
      <section className="game-card w-full max-w-sm rounded-xl border p-5 shadow-xl">
        <p className="text-xs font-black tracking-[0.18em] text-slate-300">
          HPPP · 2026
        </p>
        <h1 className="mt-2 text-2xl font-black">Create your entry</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your entry name is the 3–4 letter label shown throughout the pool.
        </p>
        {params.sent ? (
          <div
            role="status"
            className="mt-5 rounded-lg border border-emerald-500 bg-emerald-950 p-3 text-sm text-emerald-100"
          >
            Check your email to confirm your account, then sign in.
          </div>
        ) : (
          <form action={signUp} className="mt-5 grid gap-3">
            <label className="grid gap-1 text-xs font-black uppercase text-slate-300">
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                className="control-raised min-h-12 rounded-lg border px-3 text-base normal-case"
              />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-300">
              Phone
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                pattern="\+[1-9][0-9]{7,14}"
                placeholder="+12125551212"
                required
                className="control-raised min-h-12 rounded-lg border px-3 text-base normal-case"
              />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-300">
              Entry name
              <input
                name="entry_code"
                minLength={3}
                maxLength={4}
                pattern="[A-Za-z]{3,4}"
                autoCapitalize="characters"
                placeholder="HARR"
                required
                className="control-raised min-h-12 rounded-lg border px-3 text-base uppercase"
              />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-300">
              Password
              <input
                name="password"
                type="password"
                minLength={6}
                maxLength={128}
                autoComplete="new-password"
                required
                className="control-raised min-h-12 rounded-lg border px-3 text-base normal-case"
              />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase text-slate-300">
              Confirm password
              <input
                name="confirmation"
                type="password"
                minLength={6}
                maxLength={128}
                autoComplete="new-password"
                required
                className="control-raised min-h-12 rounded-lg border px-3 text-base normal-case"
              />
            </label>
            {params.error && (
              <p
                role="alert"
                className="rounded bg-amber-950 p-3 text-sm text-amber-200"
              >
                That account could not be created. Check the details or choose
                another entry name.
              </p>
            )}
            <button className="control-pressed min-h-12 rounded-lg border px-4 font-black">
              CREATE ACCOUNT
            </button>
          </form>
        )}
        <Link
          href="/login"
          className="mt-4 block text-center text-xs text-slate-400 underline"
        >
          Already registered? Sign in
        </Link>
      </section>
    </main>
  );
}
