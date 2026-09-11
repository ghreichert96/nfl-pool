import Link from "next/link";

import { CompactPageHeader } from "@/components/compact-page-header";
import { PageShell } from "@/components/page-shell";
import { requireCommissioner } from "@/lib/admin";

import { saveGame } from "../actions";
import { refreshLines, toggleLinesFreeze } from "./actions";
import { LineEditor } from "./line-editor";

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
  // Request-time week selection is intentionally dynamic.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const defaultWeek = [...(weeks ?? [])].sort(
    (a, b) =>
      Math.abs(new Date(a.lines_freeze_at).getTime() - now) -
      Math.abs(new Date(b.lines_freeze_at).getTime() - now),
  )[0];
  const activeWeek =
    (weeks ?? []).find(
      (week) => week.week_number === requestedWeek || week.id === requestedWeek,
    ) ?? defaultWeek;
  const activeIndex = (weeks ?? []).findIndex(
    (week) => week.id === activeWeek?.id,
  );
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
  return (
    <PageShell isCommissioner>
      <CompactPageHeader
        className="-mx-3 -mt-5 sm:-mx-5 sm:-mt-8"
        title="Lines"
        action={
          activeWeek ? (
            <div className="flex items-center gap-1">
              <Link
                aria-label="Previous week"
                href={`/admin/lines?week=${weeks?.[activeIndex - 1]?.week_number ?? activeWeek.week_number}`}
                className="control-raised grid size-9 place-items-center rounded border font-black"
              >
                ‹
              </Link>
              <span className="control-raised grid min-h-9 place-items-center rounded border px-2 text-xs font-black">
                {activeWeek.label}
              </span>
              <Link
                aria-label="Next week"
                href={`/admin/lines?week=${weeks?.[activeIndex + 1]?.week_number ?? activeWeek.week_number}`}
                className="control-raised grid size-9 place-items-center rounded border font-black"
              >
                ›
              </Link>
            </div>
          ) : null
        }
      />
      <div className="sr-only">
        {(weeks ?? []).map((week) => (
          <Link
            key={week.id}
            href={`/admin/lines?week=${week.week_number}`}
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
          <section className="game-card mb-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <strong className="rounded border border-slate-700 px-2 py-1 text-xs">
                {activeWeek.lines_frozen_at ? "FROZEN" : "OPEN"}
              </strong>
              <div className="flex gap-2">
                <form action={refreshLines}>
                  <input type="hidden" name="week_id" value={activeWeek.id} />
                  <button
                    disabled={Boolean(activeWeek.lines_frozen_at)}
                    className="control-raised min-h-9 rounded border px-3 text-[10px] font-black disabled:opacity-40"
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
                  <button className="control-pressed min-h-9 rounded border px-3 text-[10px] font-black">
                    {activeWeek.lines_frozen_at ? "UNFREEZE" : "FREEZE"}
                  </button>
                </form>
              </div>
            </div>
          </section>
          <section className="grid gap-1.5">
            {(games ?? []).map((game) => {
              const line = Array.isArray(game.pool_lines)
                ? game.pool_lines[0]
                : game.pool_lines;
              if (!line) return null;
              return (
                <LineEditor
                  key={game.id}
                  lineId={line.id}
                  weekId={activeWeek.id}
                  awaySpread={Number(line.away_spread)}
                  total={Number(line.total)}
                >
                  <div className="min-w-0">
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
                </LineEditor>
              );
            })}
          </section>
          <details className="game-card mt-3 rounded-lg border p-3">
            <summary className="cursor-pointer font-black">Update log</summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <ul className="space-y-2 text-xs text-slate-400">
                {(runs ?? []).map((run) => (
                  <li key={run.id}>
                    {run.status.toUpperCase()} · {run.events_received ?? 0}{" "}
                    games · {run.quota_remaining ?? "—"} requests left
                  </li>
                ))}
              </ul>
              <ul className="space-y-2 text-xs text-slate-400">
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
            </div>
          </details>
          <details className="game-card mt-3 rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-black">
              + Add game
            </summary>
            <form
              action={saveGame}
              className="mt-3 grid grid-cols-2 gap-2 text-xs"
            >
              <input
                type="hidden"
                name="week_number"
                value={activeWeek.week_number}
              />
              <label className="grid gap-1">
                Away
                <input
                  name="away_team"
                  required
                  maxLength={3}
                  className="control-raised min-h-9 rounded border px-2 uppercase"
                />
              </label>
              <label className="grid gap-1">
                Home
                <input
                  name="home_team"
                  required
                  maxLength={3}
                  className="control-raised min-h-9 rounded border px-2 uppercase"
                />
              </label>
              <label className="col-span-2 grid gap-1">
                Kickoff (ET)
                <input
                  name="kickoff_at"
                  type="datetime-local"
                  required
                  className="control-raised min-h-9 rounded border px-2"
                />
              </label>
              <label className="grid gap-1">
                Freeze (ET)
                <input
                  name="freeze_at"
                  type="datetime-local"
                  required
                  className="control-raised min-h-9 rounded border px-2"
                />
              </label>
              <label className="grid gap-1">
                Window
                <select
                  name="game_type"
                  defaultValue="sunday"
                  className="control-raised min-h-9 rounded border px-2"
                >
                  <option value="tnf">TNF</option>
                  <option value="sunday">Sunday</option>
                  <option value="snf">SNF</option>
                  <option value="mnf">MNF</option>
                  <option value="special">Special</option>
                </select>
              </label>
              <label className="grid gap-1">
                Spread
                <input
                  name="away_spread"
                  type="number"
                  step="0.5"
                  required
                  className="control-raised min-h-9 rounded border px-2"
                />
              </label>
              <label className="grid gap-1">
                Total
                <input
                  name="total"
                  type="number"
                  step="0.5"
                  min="1"
                  required
                  className="control-raised min-h-9 rounded border px-2"
                />
              </label>
              <label className="col-span-2 grid gap-1">
                Venue
                <input
                  name="venue"
                  maxLength={120}
                  className="control-raised min-h-9 rounded border px-2"
                />
              </label>
              <button className="control-raised col-span-2 min-h-9 rounded border text-[10px] font-black">
                SAVE GAME
              </button>
            </form>
          </details>
        </>
      ) : (
        <p>No week has been created.</p>
      )}
    </PageShell>
  );
}
