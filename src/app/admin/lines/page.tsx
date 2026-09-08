import Link from "next/link";

import { PageHeading, PageShell } from "@/components/page-shell";
import { requireCommissioner } from "@/lib/admin";

import { refreshLines, saveLine, toggleLinesFreeze } from "./actions";

export const dynamic = "force-dynamic";

export default async function LinesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { supabase, poolId } = await requireCommissioner();
  const { data: season } = await supabase
    .from("seasons")
    .select("id, year")
    .eq("pool_id", poolId)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: weeks } = season
    ? await supabase
        .from("pool_weeks")
        .select("id, week_number, label, lines_frozen_at, lines_freeze_at")
        .eq("season_id", season.id)
        .order("week_number")
    : { data: [] };
  const requestedWeek = Number(
    Array.isArray(params.week) ? params.week[0] : params.week,
  );
  const activeWeek =
    (weeks ?? []).find((week) => week.id === requestedWeek) ?? weeks?.[0];
  const [{ data: games }, { data: audit }, { data: runs }] = activeWeek
    ? await Promise.all([
        supabase
          .from("games")
          .select(
            "id, away_team, home_team, kickoff_at, line_lock_at, game_type, pool_lines(id, away_spread, total, source, updated_at)",
          )
          .eq("week_id", activeWeek.id)
          .order("kickoff_at"),
        supabase
          .from("line_audit_events")
          .select(
            "id, game_id, event_type, source, previous_away_spread, new_away_spread, previous_total, new_total, was_frozen, created_at",
          )
          .eq("week_id", activeWeek.id)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("odds_ingestion_runs")
          .select("id, status, events_received, quota_remaining, created_at")
          .eq("week_id", activeWeek.id)
          .order("created_at", { ascending: false })
          .limit(3),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const notice = params.saved
    ? "Line saved."
    : params.refreshed
      ? "Board refreshed from consensus odds."
      : params.frozen
        ? "Lines frozen."
        : params.unfrozen
          ? "Lines unfrozen."
          : null;
  const error = typeof params.error === "string" ? params.error : null;
  // Request-time deadline state is intentionally dynamic.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <PageShell isCommissioner>
      <PageHeading
        eyebrow={`Commissioner · ${season?.year ?? "Season"}`}
        title="Spreads & lines"
        description="Full refresh requires an open board. Individual commissioner edits remain available while frozen and are audited."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {(weeks ?? []).map((week) => (
          <Link
            key={week.id}
            href={`/admin/lines?week=${week.id}`}
            className={`rounded-md border px-3 py-2 text-xs font-black ${week.id === activeWeek?.id ? "control-pressed" : "control-raised"}`}
          >
            {week.label}
          </Link>
        ))}
      </div>
      {notice && (
        <p className="mb-4 rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200">
          {notice}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-red-950 p-3 text-sm text-red-200">
          {error === "frozen"
            ? "Unfreeze the board before a full refresh."
            : "That action failed. Check the values and try again."}
        </p>
      )}
      {activeWeek ? (
        <>
          <section className="game-card mb-5 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">{activeWeek.label}</h2>
                <p className="text-xs text-slate-400">
                  Lines freeze Thursday at 8 PM ET. Picks lock separately at
                  each kickoff.
                </p>
              </div>
              <strong className="rounded-full border border-slate-700 px-3 py-1 text-xs">
                {activeWeek.lines_frozen_at ? "FROZEN" : "OPEN"}
              </strong>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <form action={refreshLines}>
                <input type="hidden" name="week_id" value={activeWeek.id} />
                <button
                  disabled={Boolean(activeWeek.lines_frozen_at)}
                  className="control-raised min-h-10 rounded-md border px-4 text-xs font-black disabled:opacity-40"
                >
                  REFRESH LINES
                </button>
              </form>
              <form action={toggleLinesFreeze}>
                <input type="hidden" name="week_id" value={activeWeek.id} />
                <input
                  type="hidden"
                  name="freeze"
                  value={activeWeek.lines_frozen_at ? "0" : "1"}
                />
                <button className="control-pressed min-h-10 rounded-md border px-4 text-xs font-black">
                  {activeWeek.lines_frozen_at ? "UNFREEZE" : "FREEZE"}
                </button>
              </form>
            </div>
          </section>
          <section className="grid gap-3">
            {(games ?? []).map((game) => {
              const line = Array.isArray(game.pool_lines)
                ? game.pool_lines[0]
                : game.pool_lines;
              if (!line) return null;
              return (
                <form
                  key={game.id}
                  action={saveLine}
                  className="game-card grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end"
                >
                  <input type="hidden" name="line_id" value={line.id} />
                  <input type="hidden" name="week_id" value={activeWeek.id} />
                  <div>
                    <strong className="block">
                      {game.away_team} at {game.home_team}
                    </strong>
                    <small className="text-slate-500">
                      {new Date(game.kickoff_at).toLocaleString("en-US", {
                        timeZone: "America/New_York",
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      ET ·{" "}
                      {game.game_type === "special"
                        ? "SPE"
                        : game.game_type.toUpperCase()}{" "}
                      · {line.source}
                    </small>
                    <small
                      className={`mt-1 block font-black uppercase ${new Date(game.line_lock_at).getTime() <= now ? "text-amber-300" : "text-cyan-300"}`}
                    >
                      {new Date(game.line_lock_at).getTime() <= now
                        ? "Line frozen"
                        : `Line open until ${new Date(game.line_lock_at).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" })} ET`}
                    </small>
                  </div>
                  <label className="grid gap-1 text-xs font-bold">
                    Away spread
                    <input
                      className="control-raised min-h-10 rounded-md border bg-transparent px-3"
                      name="away_spread"
                      type="number"
                      step="0.5"
                      defaultValue={line.away_spread}
                      required
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold">
                    Total
                    <input
                      className="control-raised min-h-10 rounded-md border bg-transparent px-3"
                      name="total"
                      type="number"
                      step="0.5"
                      min="1"
                      defaultValue={line.total}
                      required
                    />
                  </label>
                  <button className="control-raised min-h-10 rounded-md border px-4 text-xs font-black">
                    SAVE
                  </button>
                </form>
              );
            })}
          </section>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <section className="game-card rounded-xl border p-4">
              <h2 className="font-black">Recent pulls</h2>
              <ul className="mt-3 space-y-2 text-xs text-slate-400">
                {(runs ?? []).map((run) => (
                  <li key={run.id}>
                    {run.status.toUpperCase()} · {run.events_received ?? 0}{" "}
                    games · {run.quota_remaining ?? "—"} requests left
                  </li>
                ))}
              </ul>
            </section>
            <section className="game-card rounded-xl border p-4">
              <h2 className="font-black">Line audit</h2>
              <ul className="mt-3 space-y-2 text-xs text-slate-400">
                {(audit ?? []).map((event) => (
                  <li key={event.id}>
                    {event.event_type.replace("_", " ").toUpperCase()} ·{" "}
                    {event.source}
                    {event.was_frozen ? " · frozen override" : ""} ·{" "}
                    {new Date(event.created_at).toLocaleString("en-US", {
                      timeZone: "America/New_York",
                    })}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      ) : (
        <p>No week has been created.</p>
      )}
    </PageShell>
  );
}
