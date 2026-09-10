import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchEspnNflScoreboard, type EspnLiveEvent } from "./provider";

const MAX_GAME_AGE_MS = 10 * 60 * 60 * 1000;
const MATCH_TOLERANCE_MS = 6 * 60 * 60 * 1000;
const FINAL_VALIDATION_DELAY_MS = 10 * 60 * 1000;

type PoolGame = {
  id: number;
  week_id: number;
  espn_event_id: string | null;
  away_team: string;
  home_team: string;
  kickoff_at: string;
  status: string;
  away_score: number | null;
  home_score: number | null;
  status_detail: string | null;
  live_state: string;
  live_period: number | null;
  live_clock: string | null;
  final_detected_at: string | null;
  game_results:
    | { source: "commissioner" | "provider" }
    | Array<{ source: "commissioner" | "provider" }>
    | null;
};

export async function ingestEspnLiveStatus({
  admin,
  now = new Date(),
  fetcher = fetch,
}: {
  admin: SupabaseClient;
  now?: Date;
  fetcher?: typeof fetch;
}) {
  const from = new Date(now.getTime() - MAX_GAME_AGE_MS).toISOString();
  const { data, error } = await admin
    .from("games")
    .select(
      "id, week_id, espn_event_id, away_team, home_team, kickoff_at, status, away_score, home_score, status_detail, live_state, live_period, live_clock, final_detected_at, game_results(source)",
    )
    .in("status", ["scheduled", "live"])
    .gte("kickoff_at", from)
    .lte("kickoff_at", now.toISOString())
    .order("kickoff_at");
  if (error) throw error;
  const games = (data ?? []) as unknown as PoolGame[];
  if (!games.length)
    return { status: "skipped" as const, reason: "no_active_games" };

  const { data: run, error: runError } = await admin
    .from("live_status_ingestion_runs")
    .insert({ week_id: games[0].week_id, status: "running" })
    .select("id")
    .single();
  if (runError || !run)
    throw runError ?? new Error("Could not create ESPN run");

  try {
    const events = await fetchEspnNflScoreboard(fetcher);
    let gamesUpdated = 0;
    const failures: string[] = [];

    for (const game of games) {
      const result = first(game.game_results);
      if (result?.source === "commissioner") continue;
      const event = matchEspnEvent(game, events);
      if (!event) {
        failures.push(`${game.id}: ESPN event not matched`);
        continue;
      }
      if (event.state === "scheduled") continue;

      const finalPending = event.state === "final";
      const nextStatus =
        event.state === "postponed" || event.state === "cancelled"
          ? event.state
          : "live";
      const unchanged =
        game.espn_event_id === event.id &&
        game.away_score === event.awayScore &&
        game.home_score === event.homeScore &&
        game.status === nextStatus &&
        game.status_detail === event.detail &&
        game.live_period === event.period &&
        game.live_clock === event.clock &&
        game.live_state === (finalPending ? "final_pending" : event.state);
      const update: Record<string, unknown> = {
        espn_event_id: event.id,
        away_score: event.awayScore,
        home_score: event.homeScore,
        status: nextStatus,
        status_detail: event.detail,
        live_period: event.period,
        live_clock: event.clock || null,
        live_state: finalPending ? "final_pending" : event.state,
        live_status_updated_at: now.toISOString(),
      };
      if (finalPending && !game.final_detected_at) {
        update.final_detected_at = now.toISOString();
        update.final_validation_state = "pending";
        update.final_validation_next_at = new Date(
          now.getTime() + FINAL_VALIDATION_DELAY_MS,
        ).toISOString();
        update.final_validation_attempts = 0;
        update.final_validation_error = null;
      }
      const { error: updateError } = await admin
        .from("games")
        .update(update)
        .eq("id", game.id);
      if (updateError) {
        failures.push(`${game.id}: ${updateError.message}`);
        continue;
      }
      if (!unchanged) gamesUpdated += 1;
    }

    const status = failures.length ? "partial" : "succeeded";
    await admin
      .from("live_status_ingestion_runs")
      .update({
        status,
        completed_at: new Date().toISOString(),
        events_received: events.length,
        games_updated: gamesUpdated,
        error_message: failures.length
          ? failures.join("; ").slice(0, 1000)
          : null,
      })
      .eq("id", run.id);
    return {
      status,
      runId: run.id,
      events: events.length,
      gamesUpdated,
      failures,
    };
  } catch (runFailure) {
    await admin
      .from("live_status_ingestion_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message:
          runFailure instanceof Error
            ? runFailure.message.slice(0, 1000)
            : "Unknown ESPN ingestion error",
      })
      .eq("id", run.id);
    throw runFailure;
  }
}

export function matchEspnEvent(
  game: Pick<
    PoolGame,
    "espn_event_id" | "away_team" | "home_team" | "kickoff_at"
  >,
  events: EspnLiveEvent[],
) {
  if (game.espn_event_id)
    return events.find((event) => event.id === game.espn_event_id) ?? null;
  const kickoff = new Date(game.kickoff_at).getTime();
  const matches = events.filter(
    (event) =>
      event.awayTeam === game.away_team &&
      event.homeTeam === game.home_team &&
      Math.abs(new Date(event.kickoffAt).getTime() - kickoff) <=
        MATCH_TOLERANCE_MS,
  );
  return matches.length === 1 ? matches[0] : null;
}

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
