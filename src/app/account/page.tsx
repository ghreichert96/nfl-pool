import Link from "next/link";

import { PageHeading, PageShell } from "@/components/page-shell";
import { loadCompetition } from "@/features/competition/data";
import { gamesBack } from "@/features/competition/scoring";
import { getPoolContext } from "@/lib/pool-context";

import { signOut, updateProfile } from "./actions";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    password_saved?: string;
    error?: string;
  }>;
}) {
  const context = await getPoolContext();
  const params = await searchParams;
  const { supabase, entry, profile, email, isCommissioner } = context;
  const { data: season } = entry
    ? await supabase
        .from("seasons")
        .select("year, status")
        .eq("id", entry.season_id)
        .maybeSingle()
    : { data: null };
  const competition = entry
    ? await loadCompetition(supabase, entry.season_id)
    : null;
  const standing = competition?.standings.find(
    (item) => item.entryId === entry?.id,
  );
  const financial = entry ? competition?.financials.get(entry.id) : undefined;

  return (
    <PageShell
      entryCode={entry?.entry_code}
      isCommissioner={isCommissioner}
      refreshWhileLive={Boolean(
        competition?.games.some((game) => game.status === "live"),
      )}
    >
      <PageHeading eyebrow="" title="Profile" />
      {standing && (
        <section className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[
            ["Record", `${standing.wins}-${standing.losses}-${standing.ties}`],
            ["GB", gamesBack(standing, competition!.standings).toFixed(1)],
            ["UD Pts", standing.underdogPoints.toFixed(1)],
            ["SD", `${standing.suddenDeathStrikes}/2`],
            ["Main $", formatMoney(financial?.main ?? 0)],
            ["Net $", formatMoney(financial?.net ?? 0)],
          ].map(([label, value]) => (
            <div key={label} className="game-card rounded-lg border p-3">
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">
                {label}
              </span>
              <strong className="mt-1 block text-sm">{value}</strong>
            </div>
          ))}
        </section>
      )}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
        <section className="game-card rounded-xl border p-5 shadow-xl">
          <h2 className="text-base font-black">Personal details</h2>
          {params.saved && (
            <p
              role="status"
              className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950 p-3 text-sm text-emerald-200"
            >
              Profile saved.
            </p>
          )}
          {params.password_saved && (
            <p
              role="status"
              className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950 p-3 text-sm text-emerald-200"
            >
              Password saved. You can now use password or email-link sign-in.
            </p>
          )}
          {params.error && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-amber-800 bg-amber-950 p-3 text-sm text-amber-200"
            >
              Profile could not be saved.
            </p>
          )}
          <form action={updateProfile} className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-400">
              Entry name
              <input
                name="entry_code"
                required
                minLength={3}
                maxLength={4}
                pattern="[A-Za-z]{3,4}"
                defaultValue={entry?.entry_code ?? profile?.display_name ?? ""}
                className="control-raised min-h-12 rounded-lg border px-3 text-base uppercase tracking-normal text-slate-100"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-400">
              Email
              <input
                value={email}
                readOnly
                className="min-h-12 rounded-lg border border-slate-800 bg-slate-950 px-3 text-base font-normal normal-case tracking-normal text-slate-500"
              />
            </label>
            <button className="control-pressed min-h-12 rounded-lg border text-sm font-black">
              SAVE PROFILE
            </button>
          </form>
          <Link
            href="/account/password"
            className="control-raised mt-3 grid min-h-12 place-items-center rounded-lg border text-sm font-black"
          >
            SET OR CHANGE PASSWORD
          </Link>
        </section>
        <div className="space-y-4">
          <section className="game-card rounded-xl border p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">
              Current entry
            </p>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black">
                  {entry?.entry_code ?? "—"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {season?.year ?? "2026"} season
                </p>
              </div>
              <span className="rounded-full border border-emerald-800 bg-emerald-950 px-2 py-1 text-[9px] font-black uppercase text-emerald-300">
                {season?.status ?? "Not enrolled"}
              </span>
            </div>
            {isCommissioner && (
              <p className="mt-4 border-t border-slate-800 pt-3 text-xs font-bold text-cyan-300">
                Commissioner access enabled
              </p>
            )}
          </section>
          <form action={signOut}>
            <button className="control-raised min-h-12 w-full rounded-lg border text-sm font-black">
              SIGN OUT
            </button>
          </form>
        </div>
      </div>
      <section
        id="history"
        className="game-card mt-4 overflow-hidden rounded-xl border"
      >
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="font-black">Submission log</h2>
          <p className="text-xs text-slate-500">
            Open any week for its picks, results, comment, and revision history.
          </p>
        </div>
        {competition?.weeks.length ? (
          competition.weeks.map((week) => {
            const revisions = competition.submissions.filter(
              (submission) =>
                submission.entry_id === entry?.id &&
                submission.week_id === week.id,
            );
            const latest = revisions.sort((a, b) => b.revision - a.revision)[0];
            const comment = competition.comments.find(
              (item) => item.entry_id === entry?.id && item.week_id === week.id,
            );
            const weekPicks = competition.picks.filter(
              (pick) =>
                pick.entryId === entry?.id &&
                competition.games.find((game) => game.id === pick.gameId)
                  ?.weekId === week.id,
            );
            return (
              <a
                key={week.id}
                href={`/account/week/${week.week_number}`}
                className="grid grid-cols-[1fr_auto] items-center border-b border-slate-800 px-4 py-3 last:border-b-0 hover:bg-slate-800/40"
              >
                <div>
                  <strong className="text-sm">{week.label}</strong>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {latest
                      ? `${weekPicks.length} picks · ${revisions.length} revision${revisions.length === 1 ? "" : "s"} · ${new Date(latest.submitted_at).toLocaleDateString("en-US")}`
                      : "No submission"}
                    {comment ? " · Comment" : ""}
                  </p>
                </div>
                <span className="text-lg text-slate-500">›</span>
              </a>
            );
          })
        ) : (
          <p className="p-5 text-sm text-slate-500">
            No weeks are available yet.
          </p>
        )}
      </section>
    </PageShell>
  );
}

function formatMoney(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}$${Math.abs(value).toFixed(value % 1 ? 2 : 0)}`;
}
