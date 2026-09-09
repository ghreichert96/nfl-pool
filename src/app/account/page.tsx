import Link from "next/link";

import { CompactPageHeader } from "@/components/compact-page-header";
import { PageShell } from "@/components/page-shell";
import { PhoneInput } from "@/components/phone-input";
import { ProfilePreferences } from "@/components/profile-preferences";
import {
  ProfileViewSelector,
  type ProfileView,
} from "@/components/profile-view-selector";
import { WeekSelector } from "@/components/week-selector";
import { loadCompetition } from "@/features/competition/data";
import { gamesBack } from "@/features/competition/scoring";
import { getPoolContext } from "@/lib/pool-context";

import { signOut, updateSettings } from "./actions";

const profileViews = new Set<ProfileView>(["entry", "settings", "submissions"]);

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{
    section?: string;
    week?: string;
    saved?: string;
    password_saved?: string;
    error?: string;
  }>;
}) {
  const context = await getPoolContext();
  const params = await searchParams;
  const requestedView = params.section as ProfileView;
  const view = profileViews.has(requestedView) ? requestedView : "entry";
  const { supabase, entry, email, isCommissioner, userId } = context;
  const [{ data: season }, { data: privateProfile }, { data: weeks }] =
    await Promise.all([
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
        .eq("id", userId)
        .maybeSingle(),
      entry
        ? supabase
            .from("pool_weeks")
            .select("id, week_number, label")
            .eq("season_id", entry.season_id)
            .not("published_at", "is", null)
            .order("week_number")
        : Promise.resolve({ data: [] }),
    ]);
  const requestedWeek = Number(params.week);
  const selectedWeek =
    (weeks ?? []).find((week) => week.week_number === requestedWeek) ??
    weeks?.at(-1) ??
    null;
  const competition =
    entry && view === "entry"
      ? await loadCompetition(supabase, entry.season_id, undefined, {
          includeComments: false,
          includeTeams: false,
        })
      : null;
  const standing = competition?.standings.find(
    (item) => item.entryId === entry?.id,
  );
  const financial = entry ? competition?.financials.get(entry.id) : undefined;
  const [{ data: revisions }, { data: comment }] =
    entry && selectedWeek && view === "submissions"
      ? await Promise.all([
          supabase
            .from("weekly_submissions")
            .select("id, revision, submitted_at")
            .eq("entry_id", entry.id)
            .eq("week_id", selectedWeek.id)
            .order("revision", { ascending: false }),
          supabase
            .from("weekly_comments")
            .select("body, updated_at")
            .eq("entry_id", entry.id)
            .eq("week_id", selectedWeek.id)
            .maybeSingle(),
        ])
      : [{ data: [] }, { data: null }];
  const latestSubmission = revisions?.[0];
  const { count: pickCount } = latestSubmission
    ? await supabase
        .from("picks")
        .select("id", { count: "exact", head: true })
        .eq("submission_id", latestSubmission.id)
    : { count: 0 };

  return (
    <PageShell
      entryCode={entry?.entry_code}
      isCommissioner={isCommissioner}
      compact
      refreshWhileLive={Boolean(
        competition?.games.some((game) => game.status === "live"),
      )}
    >
      <div className="pb-3 sm:pb-5">
        <CompactPageHeader
          sticky
          title="Profile"
          className="mb-3"
          action={
            <div className="flex items-center gap-1.5">
              {view === "submissions" && selectedWeek && (
                <WeekSelector
                  weeks={weeks ?? []}
                  selected={selectedWeek.week_number}
                  preserve={{ section: "submissions" }}
                />
              )}
              <ProfileViewSelector view={view} />
            </div>
          }
        />

        {view === "entry" && (
          <>
            {standing && (
              <PerformanceStats
                values={[
                  [
                    "Record",
                    `${standing.wins}-${standing.losses}-${standing.ties}`,
                  ],
                  [
                    "GB",
                    gamesBack(standing, competition!.standings).toFixed(1),
                  ],
                  ["UD Pts", standing.underdogPoints.toFixed(1)],
                  ["SD", `${standing.suddenDeathStrikes}/2`],
                  ["Main $", formatMoney(financial?.main ?? 0)],
                  ["Net $", formatMoney(financial?.net ?? 0)],
                ]}
              />
            )}
            <section className="game-card grid grid-cols-2 gap-x-3 gap-y-4 rounded-xl border p-4 text-sm">
              <Info label="Entry" value={entry?.entry_code ?? "—"} />
              <Info label="Season" value={String(season?.year ?? "2026")} />
              <Info label="Email" value={email || "—"} />
              <Info label="Phone" value={privateProfile?.phone_e164 ?? "—"} />
              <Info label="Status" value={season?.status ?? "Not enrolled"} />
              <Info
                label="Access"
                value={isCommissioner ? "Commissioner" : "Entrant"}
              />
            </section>
          </>
        )}

        {view === "settings" && (
          <section className="game-card mx-auto max-w-lg rounded-xl border p-4">
            {params.saved && (
              <p className="mb-3 rounded bg-emerald-950 p-2 text-xs text-emerald-200">
                Settings saved. Email changes may require confirmation.
              </p>
            )}
            {params.password_saved && (
              <p className="mb-3 rounded bg-emerald-950 p-2 text-xs text-emerald-200">
                Password updated.
              </p>
            )}
            {params.error && (
              <p className="mb-3 rounded bg-amber-950 p-2 text-xs text-amber-200">
                Settings could not be saved. Check the fields and entry name.
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
        )}

        {view === "submissions" && (
          <section className="game-card overflow-hidden rounded-xl border">
            <div className="border-b border-slate-800 px-4 py-3">
              <h2 className="font-black">{selectedWeek?.label ?? "No week"}</h2>
              <p className="text-xs text-slate-400">
                {latestSubmission
                  ? `${pickCount ?? 0} picks · ${revisions?.length ?? 0} revision${revisions?.length === 1 ? "" : "s"} · latest ${new Date(latestSubmission.submitted_at).toLocaleString("en-US")}`
                  : "No submission"}
              </p>
            </div>
            {comment?.body && (
              <p className="border-b border-slate-800 px-4 py-3 text-sm">
                “{comment.body}”
              </p>
            )}
            {selectedWeek && (
              <Link
                href={`/account/week/${selectedWeek.week_number}`}
                className="flex min-h-12 items-center justify-between px-4 text-xs font-black uppercase"
              >
                Full weekly record <span aria-hidden="true">›</span>
              </Link>
            )}
          </section>
        )}
      </div>
    </PageShell>
  );
}

function PerformanceStats({ values }: { values: [string, string][] }) {
  return (
    <section className="mb-3 grid grid-cols-6 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
      {values.map(([label, value]) => (
        <div
          key={label}
          className="min-w-0 border-r border-slate-800 px-1 py-2 text-center last:border-r-0"
        >
          <span className="block truncate text-[7px] font-black uppercase text-slate-400">
            {label}
          </span>
          <strong className="mt-0.5 block truncate text-[11px]">{value}</strong>
        </div>
      ))}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-[8px] font-black uppercase text-slate-400">
        {label}
      </span>
      <p className="mt-0.5 truncate font-bold">{value}</p>
    </div>
  );
}

function formatMoney(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}$${Math.abs(value).toFixed(value % 1 ? 2 : 0)}`;
}
