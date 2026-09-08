import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { signOut } from "./actions";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) redirect("/login");

  const email =
    typeof data.claims.email === "string" ? data.claims.email : "Signed in";

  return (
    <main className="pick-shell gunmetal mx-auto grid min-h-screen max-w-2xl place-items-center bg-slate-950 px-4 text-slate-100">
      <section className="game-card w-full max-w-sm rounded-xl border p-5 shadow-xl">
        <p className="text-xs font-black tracking-[0.18em] text-slate-300">
          HPPP · PROFILE
        </p>
        <h1 className="mt-2 text-xl font-black">{email}</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your entry details will appear here after enrollment.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link
            href="/"
            className="control-raised grid min-h-11 place-items-center rounded-lg border text-sm font-black"
          >
            BACK
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="control-raised min-h-11 w-full rounded-lg border text-sm font-black"
            >
              SIGN OUT
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
