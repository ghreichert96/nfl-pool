import Link from "next/link";

import { requestMagicLink } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const error = typeof params.error === "string";

  return (
    <main className="pick-shell gunmetal mx-auto grid min-h-screen max-w-2xl place-items-center bg-slate-950 px-4 text-slate-100">
      <section className="game-card w-full max-w-sm rounded-xl border p-5 shadow-xl">
        <p className="text-xs font-black tracking-[0.18em] text-slate-300">
          HPPP · 2026
        </p>
        <h1 className="mt-2 text-2xl font-black">Sign in</h1>
        <p className="mt-2 text-sm text-slate-400">
          Enter the email address tied to your pool invitation. We’ll send a
          one-time sign-in link.
        </p>

        {sent ? (
          <div
            role="status"
            className="mt-5 rounded-lg border border-emerald-500 bg-emerald-950 p-3 text-sm text-emerald-100"
          >
            Check your email. The sign-in link expires after 24 hours.
          </div>
        ) : (
          <form action={requestMagicLink} className="mt-5 space-y-3">
            <label
              htmlFor="email"
              className="block text-xs font-black uppercase tracking-wide text-slate-300"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="min-h-12 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-base outline-none focus:border-slate-200"
            />
            {error && (
              <p role="alert" className="text-sm text-amber-300">
                We couldn’t send a link. Check the address or try again shortly.
              </p>
            )}
            <button
              type="submit"
              className="control-pressed min-h-12 w-full rounded-lg border px-4 font-black"
            >
              EMAIL SIGN-IN LINK
            </button>
          </form>
        )}

        <Link
          href="/"
          className="mt-5 block text-center text-xs text-slate-400 underline"
        >
          Back to pool
        </Link>
      </section>
    </main>
  );
}
