import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const recoverySent = params.recovery_sent === "1";
  const error = typeof params.error === "string" ? params.error : null;
  return (
    <main className="pick-shell gunmetal mx-auto grid min-h-screen max-w-2xl place-items-center bg-slate-950 px-4 text-slate-100">
      <section className="game-card w-full max-w-sm rounded-xl border p-5 shadow-xl">
        <p className="text-xs font-black tracking-[0.18em] text-slate-300">
          HPPP · 2026
        </p>
        <h1 className="mt-2 text-2xl font-black">Sign in</h1>
        <p className="mt-2 text-sm text-slate-400">
          New here? Create an account with your email, phone, entry name, and
          password.
        </p>
        <LoginForm invalidCredentials={error === "invalid-credentials"} />
        {sent || recoverySent ? (
          <div
            role="status"
            className="mt-4 rounded-lg border border-emerald-500 bg-emerald-950 p-3 text-sm text-emerald-100"
          >
            {recoverySent
              ? "Check your email for a password-reset link."
              : "Check your email. The sign-in link expires after 24 hours."}
          </div>
        ) : error && error !== "invalid-credentials" ? (
          <p role="alert" className="mt-4 text-sm text-amber-300">
            We couldn’t complete that request. Email links require an email
            address.
          </p>
        ) : null}
      </section>
    </main>
  );
}
