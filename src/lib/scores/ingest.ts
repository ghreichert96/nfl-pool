import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchNflScores, type ScoreEvent } from "@/lib/odds/provider";
import { saveFinalGameResult } from "./result";

export const SCORE_QUOTA_RESERVE = 49;
const RECONCILIATION_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const SLATE_KICKOFF_WINDOW_MS = 90 * 60 * 1000;
const MAX_SLATE_HOLD_MS = 45 * 60 * 1000;

type GameRow = {
  id: number;
  week_id: number;
  provider_event_id: string;
  away_team: string;
  home_team: string;
  kickoff_at: string;
  status: string;
  away_score: number | null;
  home_score: number | null;
  score_provider_updated_at: string | null;
  live_state: string;
  final_detected_at: string | null;
  final_validation_attempts: number;
  pool_lines:
    | { away_spread: number | string; total: number | string }
    | Array<{ away_spread: number | string; total: number | string }>;
  game_results:
    | {
        source: "commissioner" | "provider";
        away_score: number;
        home_score: number;
      }
    | Array<{
        source: "commissioner" | "provider";
        away_score: number;
        home_score: number;
      }>
    | null;
};

export function shouldProtectReserve(
  quotaRemaining: number | null,
  includeCompleted: boolean,
) {
  return (
    !includeCompleted &&
    quotaRemaining !== null &&
    quotaRemaining <= SCORE_QUOTA_RESERVE
  );
}

export function scoresForEvent(event: ScoreEvent) {
  if (!event.scores) return null;
  const byName = new Map(
    event.scores.map((score) => [score.name, Number(score.score)]),
  );
  const awayScore = byName.get(event.away_team);
  const homeScore = byName.get(event.home_team);
  if (
    !Number.isSafeInteger(awayScore) ||
    !Number.isSafeInteger(homeScore) ||
    awayScore! < 0 ||
    homeScore! < 0
  )
    return null;
  return { awayScore: awayScore!, homeScore: homeScore! };
}

export async function ingestScores({
  admin,
  apiKey,
  mode,
  now = new Date(),
}: {
  admin: SupabaseClient;
  apiKey: string;
  mode: "validate" | "reconcile";
  now?: Date;
}) {
  const nowMs = now.getTime();
  const from = new Date(nowMs - RECONCILIATION_AGE_MS).toISOString();
  let query = admin
    .from("games")
    .select(
      "id, week_id, provider_event_id, away_team, home_team, kickoff_at, status, away_score, home_score, score_provider_updated_at, live_state, final_detected_at, final_validation_attempts, pool_lines(away_spread,total), game_results(source,away_score,home_score)",
    )
    .not("provider_event_id", "is", null)
    .gte("kickoff_at", from)
    .lte("kickoff_at", now.toISOString())
    .order("kickoff_at");
  if (mode === "validate")
    query = query
      .in("final_validation_state", ["pending", "retry"])
      .lte("final_validation_next_at", now.toISOString());
  else query = query.neq("status", "final");
  const { data, error } = await query;
  if (error) throw error;
  let games = (data ?? []) as unknown as GameRow[];
  if (!games.length)
    return { status: "skipped" as const, reason: "no_active_games" };

  if (mode === "validate") {
    const weekIds = [...new Set(games.map((game) => game.week_id))];
    const { data: activeData, error: activeError } = await admin
      .from("games")
      .select("id, week_id, kickoff_at, live_state")
      .in("week_id", weekIds)
      .eq("status", "live")
      .neq("live_state", "final_pending");
    if (activeError) throw activeError;
    games = games.filter(
      (game) =>
        !shouldHoldForSlate(
          game,
          (activeData ?? []) as Array<{
            id: number;
            week_id: number;
            kickoff_at: string;
            live_state: string;
          }>,
          now,
        ),
    );
    if (!games.length)
      return { status: "skipped" as const, reason: "slate_still_active" };
  }

  const { data: run, error: runError } = await admin
    .from("score_ingestion_runs")
    .insert({ week_id: games[0].week_id, mode, status: "running" })
    .select("id")
    .single();
  if (runError || !run)
    throw runError ?? new Error("Could not create score run");

  try {
    const response = await fetchNflScores(apiKey, {
      includeCompleted: true,
      eventIds: games.map((game) => game.provider_event_id),
    });
    let gamesUpdated = 0;
    let gamesFinalized = 0;
    const failures: string[] = response.invalidEvents
      ? [`${response.invalidEvents} malformed provider event(s)`]
      : [];

    for (const game of games) {
      const event = response.events.find(
        (candidate) => candidate.id === game.provider_event_id,
      );
      if (!event?.completed) {
        if (mode === "validate") {
          await queueValidationRetry(
            admin,
            game,
            now,
            event
              ? "Provider result is not final"
              : "Provider result unavailable",
          );
          failures.push(`${game.provider_event_id}: final result unavailable`);
        }
        continue;
      }
      const scores = scoresForEvent(event);
      if (!scores) {
        if (mode === "validate")
          await queueValidationRetry(
            admin,
            game,
            now,
            "Provider scores malformed",
          );
        failures.push(`${event.id}: provider scores malformed`);
        continue;
      }
      const existingResult = first(game.game_results);
      if (existingResult?.source === "commissioner") continue;
      const unchanged =
        game.away_score === scores.awayScore &&
        game.home_score === scores.homeScore &&
        game.status === "final";
      if (unchanged) {
        await markValidated(admin, game.id);
        continue;
      }

      try {
        const line = first(game.pool_lines);
        if (!line) throw new Error("frozen line missing");
        const isCorrection =
          existingResult?.source === "provider" &&
          (existingResult.away_score !== scores.awayScore ||
            existingResult.home_score !== scores.homeScore);
        await saveFinalGameResult({
          supabase: admin,
          source: "provider",
          providerUpdatedAt: event.last_update,
          isCorrection,
          game: {
            id: game.id,
            weekId: game.week_id,
            weekNumber: 0,
            away: game.away_team,
            home: game.home_team,
            awaySpread: Number(line.away_spread),
            total: Number(line.total),
            awayScore: scores.awayScore,
            homeScore: scores.homeScore,
            status: "final",
          },
        });
        await markValidated(admin, game.id);
        gamesFinalized += 1;
        gamesUpdated += 1;
      } catch (gameError) {
        failures.push(
          `${event.id}: ${gameError instanceof Error ? gameError.message : "update failed"}`,
        );
      }
    }

    const status = failures.length ? "partial" : "succeeded";
    await admin
      .from("score_ingestion_runs")
      .update({
        status,
        completed_at: new Date().toISOString(),
        events_received: response.events.length,
        games_updated: gamesUpdated,
        games_finalized: gamesFinalized,
        quota_used: response.quota.last,
        quota_remaining: response.quota.remaining,
        error_message: failures.length
          ? failures.join("; ").slice(0, 1000)
          : null,
      })
      .eq("id", run.id);
    return {
      status,
      runId: run.id,
      includeCompleted: true,
      events: response.events.length,
      gamesUpdated,
      gamesFinalized,
      quotaRemaining: response.quota.remaining,
      failures,
    };
  } catch (runFailure) {
    await admin
      .from("score_ingestion_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message:
          runFailure instanceof Error
            ? runFailure.message.slice(0, 1000)
            : "Unknown score-ingestion error",
      })
      .eq("id", run.id);
    throw runFailure;
  }
}

export function shouldHoldForSlate(
  game: Pick<GameRow, "id" | "week_id" | "kickoff_at" | "final_detected_at">,
  activeGames: Array<{
    id: number;
    week_id: number;
    kickoff_at: string;
    live_state: string;
  }>,
  now: Date,
) {
  if (
    !game.final_detected_at ||
    now.getTime() - new Date(game.final_detected_at).getTime() >=
      MAX_SLATE_HOLD_MS
  )
    return false;
  const kickoff = new Date(game.kickoff_at).getTime();
  return activeGames.some(
    (active) =>
      active.id !== game.id &&
      active.week_id === game.week_id &&
      active.live_state !== "final_pending" &&
      Math.abs(new Date(active.kickoff_at).getTime() - kickoff) <=
        SLATE_KICKOFF_WINDOW_MS,
  );
}

async function markValidated(admin: SupabaseClient, gameId: number) {
  const { error } = await admin
    .from("games")
    .update({
      final_validation_state: "validated",
      final_validation_next_at: null,
      final_validation_error: null,
    })
    .eq("id", gameId);
  if (error) throw error;
}

export function validationRetry(
  currentAttempts: number,
  now: Date,
): {
  attempts: number;
  state: "retry" | "reconciliation";
  nextAt: string | null;
} {
  const attempts = currentAttempts + 1;
  if (attempts >= 3) return { attempts, state: "reconciliation", nextAt: null };
  const delay = attempts === 1 ? 30 * 60 * 1000 : 2 * 60 * 60 * 1000;
  return {
    attempts,
    state: "retry",
    nextAt: new Date(now.getTime() + delay).toISOString(),
  };
}

async function queueValidationRetry(
  admin: SupabaseClient,
  game: Pick<GameRow, "id" | "final_validation_attempts">,
  now: Date,
  message: string,
) {
  const retry = validationRetry(game.final_validation_attempts, now);
  const { error } = await admin
    .from("games")
    .update({
      final_validation_attempts: retry.attempts,
      final_validation_state: retry.state,
      final_validation_next_at: retry.nextAt,
      final_validation_error: message.slice(0, 500),
    })
    .eq("id", game.id);
  if (error) throw error;
}

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
