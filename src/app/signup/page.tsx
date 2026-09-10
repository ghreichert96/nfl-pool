import Link from "next/link";

import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ exists?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="pick-shell gunmetal mx-auto grid min-h-screen max-w-2xl place-items-center bg-slate-950 px-4 text-slate-100">
      <section className="game-card w-full max-w-sm rounded-xl border p-5 shadow-xl">
        <p className="text-xs font-black tracking-[0.18em] text-slate-300">
          HPPP · 2026
        </p>
        <h1 className="mt-2 text-2xl font-black">Create your entry</h1>
        {params.exists ? (
          <div
            role="status"
            className="mt-5 rounded-lg border border-emerald-500 bg-emerald-950 p-3 text-sm text-emerald-100"
          >
            Account already exists.{" "}
            <Link href="/login" className="font-black underline">
              Sign in.
            </Link>
          </div>
        ) : (
          <SignupForm error={params.error} />
        )}
        <Link
          href="/login"
          className="mt-4 block text-center text-xs text-slate-400 underline"
        >
          Sign in
        </Link>
      </section>
    </main>
  );
}
