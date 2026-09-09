import { redirect } from "next/navigation";
import Link from "next/link";

import { PageHeading, PageShell } from "@/components/page-shell";
import { PhoneInput } from "@/components/phone-input";
import { createClient } from "@/lib/supabase/server";
import { testLabEnabled } from "@/lib/test-lab";
import { SignupLinkButton } from "./signup-link-button";

import {
  generatePayoutSchedule,
  inviteEntry,
  recordGameResult,
  refreshOdds,
  saveGame,
  savePayoutSchedule,
  toggleWeekFreeze,
} from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: string;
    error?: string;
    game_saved?: string;
    game_error?: string;
    result_saved?: string;
    result_error?: string;
    payout_saved?: string;
    payout_error?: string;
    odds_refreshed?: string;
    odds_error?: string;
    odds_frozen?: string;
    odds_unfrozen?: string;
  }>;
}) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");

  const { data: commissioner } = await supabase
    .from("pool_memberships")
    .select("pool_id")
    .eq("user_id", claims.claims.sub)
    .eq("role", "commissioner")
    .maybeSingle();

  if (!commissioner) redirect("/");

  const params = await searchParams;
  const [{ count: entrantCount }, { data: season }] = await Promise.all([
    supabase
      .from("pool_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("pool_id", commissioner.pool_id),
    supabase
      .from("seasons")
      .select("id, year, status")
      .eq("pool_id", commissioner.pool_id)
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const { data: weeks } = season
    ? await supabase
        .from("pool_weeks")
        .select("id, label, lines_frozen_at")
        .eq("season_id", season.id)
        .order("week_number", { ascending: false })
    : { data: [] };
  const weekIds = (weeks ?? []).map((week) => week.id);
  const [{ data: games }, { data: payouts }, { data: audit }] = season
    ? await Promise.all([
        weekIds.length
          ? supabase
              .from("games")
              .select(
                "id, week_id, away_team, home_team, away_score, home_score, status",
              )
              .in("week_id", weekIds)
              .order("kickoff_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase
          .from("payout_schedules")
          .select("rank, amount, locked_at")
          .eq("season_id", season.id)
          .order("rank"),
        supabase
          .from("commissioner_audit_events")
          .select("id, action, entity_type, entity_id, created_at")
          .eq("pool_id", commissioner.pool_id)
          .order("created_at", { ascending: false })
          .limit(8),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const activeWeek = weeks?.[0];
  const { data: oddsRuns } = activeWeek
    ? await supabase
        .from("odds_ingestion_runs")
        .select(
          "id, status, events_received, snapshots_written, quota_remaining, created_at",
        )
        .eq("week_id", activeWeek.id)
        .order("created_at", { ascending: false })
        .limit(3)
    : { data: [] };
  return (
    <PageShell isCommissioner>
      <PageHeading
        eyebrow="Commissioner tools"
        title="Admin pane"
        description="Manage the active season, weekly slate, frozen lines, and entrants."
      />
      {testLabEnabled() && (
        <Link
          href="/admin/test-lab"
          className="game-card mb-5 flex items-center justify-between rounded-xl border border-cyan-800 p-4"
        >
          <span>
            <strong className="block text-sm text-cyan-200">
              Week simulator
            </strong>
            <small className="text-slate-500">
              Create test entries and advance through kickoff stages
            </small>
          </span>
          <span className="text-xl text-cyan-300">›</span>
        </Link>
      )}
      {activeWeek && (
        <section className="game-card mb-5 rounded-xl border p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-slate-300">
                ODDS INTAKE
              </p>
              <h2 className="mt-1 text-xl font-black">{activeWeek.label}</h2>
              <p className="mt-1 text-sm text-slate-400">
                Consensus spreads and totals from The Odds API. Frozen weeks
                retain their published pool lines.
              </p>
            </div>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-black">
              {activeWeek.lines_frozen_at ? "FROZEN" : "OPEN"}
            </span>
          </div>
          {params.odds_refreshed && (
            <p className="mt-3 rounded bg-emerald-950 p-2 text-xs text-emerald-300">
              Odds refreshed successfully.
            </p>
          )}
          {params.odds_error && (
            <p className="mt-3 rounded bg-red-950 p-2 text-xs text-red-300">
              Odds refresh failed. Check the key and recent ingestion run.
            </p>
          )}
          {(params.odds_frozen || params.odds_unfrozen) && (
            <p className="mt-3 rounded bg-emerald-950 p-2 text-xs text-emerald-300">
              Week lines {params.odds_frozen ? "frozen" : "reopened"}.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <form action={refreshOdds}>
              <input type="hidden" name="week_id" value={activeWeek.id} />
              <button
                disabled={Boolean(activeWeek.lines_frozen_at)}
                className="control-raised min-h-10 rounded border px-4 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                REFRESH ODDS
              </button>
            </form>
            <form action={toggleWeekFreeze}>
              <input type="hidden" name="week_id" value={activeWeek.id} />
              <input
                type="hidden"
                name="freeze"
                value={activeWeek.lines_frozen_at ? "0" : "1"}
              />
              <button className="control-pressed min-h-10 rounded border px-4 text-xs font-black">
                {activeWeek.lines_frozen_at ? "REOPEN LINES" : "FREEZE LINES"}
              </button>
            </form>
          </div>
          {(oddsRuns ?? []).length > 0 && (
            <ol className="mt-4 divide-y divide-slate-800 border-t border-slate-800">
              {(oddsRuns ?? []).map((run) => (
                <li
                  key={run.id}
                  className="flex flex-wrap justify-between gap-2 py-2 text-xs"
                >
                  <span>
                    <strong className="mr-2 uppercase">{run.status}</strong>
                    {run.events_received ?? 0} events ·{" "}
                    {run.snapshots_written ?? 0} prices
                  </span>
                  <span className="text-slate-500">
                    {run.quota_remaining == null
                      ? "Quota —"
                      : `${run.quota_remaining} requests left`}{" "}
                    · {new Date(run.created_at).toLocaleString("en-US")}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      <section className="mb-5 grid grid-cols-3 gap-2">
        <div className="game-card rounded-lg border p-3">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Season
          </span>
          <strong className="mt-1 block text-lg">{season?.year ?? "—"}</strong>
        </div>
        <div className="game-card rounded-lg border p-3">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Entrants
          </span>
          <strong className="mt-1 block text-lg">{entrantCount ?? 0}</strong>
        </div>
        <div className="game-card rounded-lg border p-3">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
            Status
          </span>
          <strong className="mt-1 block text-lg capitalize">
            {season?.status ?? "Setup"}
          </strong>
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="game-card mx-auto max-w-md rounded-xl border p-5 shadow-xl">
          <p className="text-xs font-black tracking-[0.18em] text-slate-300">
            HPPP · WEEKLY SETUP
          </p>
          <h1 className="mt-2 text-xl font-black">Add a game and line</h1>
          <p className="mt-2 text-sm text-slate-400">
            Times are entered in Eastern Time. Adding the first game creates the
            week.
          </p>
          {params.game_saved ? (
            <p className="mt-4 rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200">
              Game and line saved.
            </p>
          ) : null}
          {params.game_error ? (
            <p className="mt-4 rounded-lg bg-amber-950 p-3 text-sm text-amber-200">
              The game could not be saved. Check every value and try again.
            </p>
          ) : null}
          <form action={saveGame} className="mt-5 grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm font-bold">
              Week
              <input
                name="week_number"
                type="number"
                min="1"
                max="22"
                defaultValue="1"
                required
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Line freeze (ET)
              <input
                name="freeze_at"
                type="datetime-local"
                required
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Away
              <input
                name="away_team"
                required
                maxLength={3}
                placeholder="DAL"
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3 uppercase"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Home
              <input
                name="home_team"
                required
                maxLength={3}
                placeholder="PHI"
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3 uppercase"
              />
            </label>
            <label className="col-span-2 grid gap-1 text-sm font-bold">
              Kickoff (ET)
              <input
                name="kickoff_at"
                type="datetime-local"
                required
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Away spread
              <input
                name="away_spread"
                type="number"
                step="0.5"
                required
                placeholder="-3.5"
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Total
              <input
                name="total"
                type="number"
                step="0.5"
                min="1"
                required
                placeholder="47.5"
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Window
              <select
                name="game_type"
                defaultValue="sunday"
                className="control-raised min-h-11 rounded-lg border bg-slate-950 px-3"
              >
                <option value="tnf">TNF</option>
                <option value="international">International</option>
                <option value="sunday">Sunday</option>
                <option value="snf">SNF</option>
                <option value="mnf">MNF</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Venue
              <input
                name="venue"
                maxLength={120}
                placeholder="Optional"
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3"
              />
            </label>
            <button
              type="submit"
              className="control-raised col-span-2 mt-2 min-h-11 rounded-lg border bg-emerald-600 font-black text-white"
            >
              SAVE GAME
            </button>
          </form>
        </section>
        <section className="game-card mx-auto max-w-md rounded-xl border p-5 shadow-xl">
          <p className="text-xs font-black tracking-[0.18em] text-slate-300">
            HPPP · COMMISSIONER
          </p>
          <h1 className="mt-2 text-xl font-black">Invite an entrant</h1>
          <p className="mt-2 text-sm text-slate-400">
            Share the public signup link, or send a seven-day invitation to a
            specific email address.
          </p>
          <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950 p-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
              Self-enrollment
            </p>
            <SignupLinkButton />
          </div>
          {params.sent ? (
            <p className="mt-4 rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200">
              Invitation sent.
            </p>
          ) : null}
          {params.error ? (
            <p className="mt-4 rounded-lg bg-amber-950 p-3 text-sm text-amber-200">
              We could not create that invitation. Check the email and entry
              code, then try again.
            </p>
          ) : null}
          <form action={inviteEntry} className="mt-5 grid gap-3">
            <label className="grid gap-1 text-sm font-bold">
              Email
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                className="control-raised min-h-11 rounded-lg border bg-transparent px-3"
                placeholder="entrant@example.com"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Phone number
              <PhoneInput className="control-raised min-h-11 rounded-lg border bg-transparent px-3" />
              <small className="font-normal text-slate-500">
                U.S. numbers automatically receive +1.
              </small>
            </label>
            <button
              type="submit"
              className="control-raised mt-2 min-h-11 rounded-lg border bg-emerald-600 font-black text-white"
            >
              SEND INVITATION
            </button>
          </form>
        </section>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="game-card rounded-xl border p-5">
          <p className="text-xs font-black tracking-[0.18em] text-slate-300">
            RESULTS
          </p>
          <h2 className="mt-2 text-xl font-black">Record final scores</h2>
          <p className="mt-2 text-sm text-slate-400">
            Saving a correction replaces the game’s score events and refreshes
            standings.
          </p>
          {params.result_saved && (
            <p className="mt-3 rounded bg-emerald-950 p-2 text-xs text-emerald-300">
              Result saved and rescored.
            </p>
          )}
          {params.result_error && (
            <p className="mt-3 rounded bg-red-950 p-2 text-xs text-red-300">
              Result could not be saved.
            </p>
          )}
          <div className="mt-4 max-h-96 space-y-2 overflow-auto">
            {(games ?? []).map((game) => (
              <form
                key={game.id}
                action={recordGameResult}
                className="grid grid-cols-[1fr_58px_12px_58px_64px] items-center gap-1 rounded-lg border border-slate-800 p-2"
              >
                <input type="hidden" name="game_id" value={game.id} />
                <label className="text-xs font-black">
                  {game.away_team} @ {game.home_team}
                  <small className="block font-normal text-slate-500">
                    {game.status}
                  </small>
                </label>
                <input
                  aria-label={`${game.away_team} score`}
                  name="away_score"
                  type="number"
                  min="0"
                  max="255"
                  defaultValue={game.away_score ?? ""}
                  required
                  className="control-raised min-h-9 rounded border px-1 text-center"
                />
                <span>–</span>
                <input
                  aria-label={`${game.home_team} score`}
                  name="home_score"
                  type="number"
                  min="0"
                  max="255"
                  defaultValue={game.home_score ?? ""}
                  required
                  className="control-raised min-h-9 rounded border px-1 text-center"
                />
                <button className="control-pressed min-h-9 rounded border text-[9px] font-black">
                  FINAL
                </button>
              </form>
            ))}
          </div>
        </section>
        <section className="game-card rounded-xl border p-5">
          <p className="text-xs font-black tracking-[0.18em] text-slate-300">
            MAIN POOL
          </p>
          <h2 className="mt-2 text-xl font-black">Payout schedule</h2>
          <p className="mt-2 text-sm text-slate-400">
            Amounts must sum to $0. Locking makes the schedule immutable.
          </p>
          {params.payout_saved && (
            <p className="mt-3 rounded bg-emerald-950 p-2 text-xs text-emerald-300">
              Payout schedule saved.
            </p>
          )}
          {params.payout_error && (
            <p className="mt-3 rounded bg-red-950 p-2 text-xs text-red-300">
              Schedule must be valid and balance to $0.
            </p>
          )}
          {season && (payouts ?? []).length === 0 && (
            <form action={generatePayoutSchedule} className="mt-4">
              <input type="hidden" name="season_id" value={season.id} />
              <button className="control-raised min-h-10 w-full rounded border text-xs font-black">
                GENERATE BALANCED SCHEDULE
              </button>
            </form>
          )}
          {season && (payouts ?? []).length > 0 && (
            <form action={savePayoutSchedule} className="mt-4">
              <input type="hidden" name="season_id" value={season.id} />
              <input
                type="hidden"
                name="rank_count"
                value={(payouts ?? []).length}
              />
              <div className="max-h-80 space-y-1 overflow-auto">
                {(payouts ?? []).map((row) => (
                  <label
                    key={row.rank}
                    className="grid grid-cols-[1fr_120px] items-center gap-2 text-xs"
                  >
                    <span>Rank {row.rank}</span>
                    <input
                      name={`rank_${row.rank}`}
                      type="number"
                      step="0.01"
                      defaultValue={Number(row.amount)}
                      disabled={Boolean(row.locked_at)}
                      className="control-raised min-h-9 rounded border px-2 text-right"
                    />
                  </label>
                ))}
              </div>
              {payouts?.[0]?.locked_at ? (
                <p className="mt-4 text-xs font-black text-amber-300">
                  Locked{" "}
                  {new Date(payouts[0].locked_at).toLocaleDateString("en-US")}
                </p>
              ) : (
                <div className="mt-4 flex items-center gap-3">
                  <label className="text-xs">
                    <input type="checkbox" name="lock" className="mr-2" />
                    Lock schedule
                  </label>
                  <button className="control-pressed ml-auto min-h-10 rounded border px-4 text-xs font-black">
                    SAVE
                  </button>
                </div>
              )}
            </form>
          )}
        </section>
      </div>
      <section className="game-card mt-5 rounded-xl border p-5">
        <h2 className="text-sm font-black">Recent commissioner activity</h2>
        <ol className="mt-3 divide-y divide-slate-800">
          {(audit ?? []).map((event) => (
            <li
              key={event.id}
              className="flex justify-between gap-3 py-2 text-xs"
            >
              <span>
                {event.action.replaceAll("_", " ")} · {event.entity_type}{" "}
                {event.entity_id}
              </span>
              <time className="text-slate-500">
                {new Date(event.created_at).toLocaleString("en-US")}
              </time>
            </li>
          ))}
        </ol>
      </section>
    </PageShell>
  );
}
