import Link from "next/link";

import { CompactPageHeader } from "@/components/compact-page-header";
import { PageShell } from "@/components/page-shell";
import { PhoneInput } from "@/components/phone-input";
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
  const [{ data: season }, { data: privateProfile }] = await Promise.all([
    entry
      ? supabase
          .from("seasons")
          .select("year, status")
          .eq("id", entry.season_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("profiles")
      .select("phone_e164")
      .eq("id", context.userId)
      .maybeSingle(),
  ]);
  const competition = entry
    ? await loadCompetition(supabase, entry.season_id, undefined, {
        includeTeams: false,
      })
    : null;
  const standing = competition?.standings.find(
    (item) => item.entryId === entry?.id,
  );
  const financial = entry ? competition?.financials.get(entry.id) : undefined;

  return (
    <PageShell
      entryCode={entry?.entry_code}
      isCommissioner={isCommissioner}
      compact
      refreshWhileLive={Boolean(
        competition?.games.some((game) => game.status === "live"),
      )}
    >
      <div className="py-3 sm:py-5">
        <CompactPageHeader
          title={
            <span className="flex items-center gap-2">
              Profile
              {entry && (
                <small className="text-[9px] text-amber-300">
                  {entry.entry_code} · {season?.year ?? "2026"}
                  {season?.status ? ` · ${season.status}` : ""}
                </small>
              )}
            </span>
          }
          className="mb-3"
        />
        {standing && (
          <section className="mb-3 grid grid-cols-6 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
            {[
              [
                "Record",
                `${standing.wins}-${standing.losses}-${standing.ties}`,
              ],
              ["GB", gamesBack(standing, competition!.standings).toFixed(1)],
              ["UD Pts", standing.underdogPoints.toFixed(1)],
              ["SD", `${standing.suddenDeathStrikes}/2`],
              ["Main $", formatMoney(financial?.main ?? 0)],
              ["Net $", formatMoney(financial?.net ?? 0)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="min-w-0 border-r border-slate-800 px-1 py-2 text-center last:border-r-0"
              >
                <span className="block truncate text-[7px] font-black uppercase text-slate-500">
                  {label}
                </span>
                <strong className="mt-0.5 block truncate text-[11px]">
                  {value}
                </strong>
              </div>
            ))}
          </section>
        )}
        <section className="game-card rounded-xl border p-3 shadow-xl sm:p-4">
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
          <form action={updateProfile} className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-400">
              Entry name
              <input
                name="entry_code"
                required
                minLength={3}
                maxLength={4}
                pattern="[A-Za-z]{3,4}"
                defaultValue={entry?.entry_code ?? profile?.display_name ?? ""}
                className="control-raised min-h-11 rounded-lg border px-3 text-base uppercase tracking-normal text-slate-100"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-400">
              Email
              <input
                value={email}
                readOnly
                className="min-h-11 rounded-lg border border-slate-800 bg-slate-950 px-3 text-base font-normal normal-case tracking-normal text-slate-500"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-slate-400 sm:col-span-2">
              Phone
              <PhoneInput
                defaultValue={privateProfile?.phone_e164 ?? ""}
                className="control-raised min-h-11 rounded-lg border px-3 text-base font-normal normal-case tracking-normal"
              />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2">
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
        </section>
        <section
          id="history"
          className="game-card mt-4 overflow-hidden rounded-xl border"
        >
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="font-black">Submission log</h2>
            <p className="text-xs text-slate-500">
              Open any week for its picks, results, comment, and revision
              history.
            </p>
          </div>
          {competition?.weeks.length ? (
            competition.weeks.map((week) => {
              const revisions = competition.submissions.filter(
                (submission) =>
                  submission.entry_id === entry?.id &&
                  submission.week_id === week.id,
              );
              const latest = revisions.sort(
                (a, b) => b.revision - a.revision,
              )[0];
              const comment = competition.comments.find(
                (item) =>
                  item.entry_id === entry?.id && item.week_id === week.id,
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
        <form action={signOut} className="mt-3">
          <button className="rounded-md px-2 py-1.5 text-[10px] font-bold text-red-400 underline decoration-red-800 underline-offset-2">
            SIGN OUT
          </button>
        </form>
      </div>
    </PageShell>
  );
}

function formatMoney(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}$${Math.abs(value).toFixed(value % 1 ? 2 : 0)}`;
}
