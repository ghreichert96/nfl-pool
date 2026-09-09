import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchNflScores, type ScoreEvent } from "@/lib/odds/provider";
import { saveFinalGameResult } from "./result";

export const SCORE_QUOTA_RESERVE = 49;
const MAX_GAME_AGE_MS = 8 * 60 * 60 * 1000;
const EXPECTED_GAME_LENGTH_MS = 3 * 60 * 60 * 1000;
const RECONCILIATION_AGE_MS = 3 * 24 * 60 * 60 * 1000;

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
  mode: "live" | "reconcile";
  now?: Date;
}) {
  const nowMs = now.getTime();
  const from = new Date(
    nowMs - (mode === "reconcile" ? RECONCILIATION_AGE_MS : MAX_GAME_AGE_MS),
  ).toISOString();
  let query = admin
    .from("games")
    .select(
      "id, week_id, provider_event_id, away_team, home_team, kickoff_at, status, away_score, home_score, score_provider_updated_at, pool_lines(away_spread,total), game_results(source,away_score,home_score)",
    )
    .not("provider_event_id", "is", null)
    .gte("kickoff_at", from)
    .lte("kickoff_at", now.toISOString())
    .order("kickoff_at");
  if (mode === "live") query = query.in("status", ["scheduled", "live"]);
  const { data, error } = await query;
  if (error) throw error;
  const games = (data ?? []) as unknown as GameRow[];
  if (!games.length)
    return { status: "skipped" as const, reason: "no_active_games" };

  const includeCompleted =
    mode === "reconcile" ||
    games.some(
      (game) =>
        nowMs - new Date(game.kickoff_at).getTime() >= EXPECTED_GAME_LENGTH_MS,
    );
  const quotaRemaining = await latestKnownQuota(admin);
  const { data: run, error: runError } = await admin
    .from("score_ingestion_runs")
    .insert({ week_id: games[0].week_id, mode, status: "running" })
    .select("id")
    .single();
  if (runError || !run)
    throw runError ?? new Error("Could not create score run");

  if (shouldProtectReserve(quotaRemaining, includeCompleted)) {
    await admin
      .from("score_ingestion_runs")
      .update({
        status: "skipped",
        completed_at: new Date().toISOString(),
        quota_remaining: quotaRemaining,
        skip_reason: "quota_reserve",
      })
      .eq("id", run.id);
    return {
      status: "skipped" as const,
      reason: "quota_reserve",
      runId: run.id,
    };
  }

  try {
    const response = await fetchNflScores(apiKey, {
      includeCompleted,
      eventIds: games.map((game) => game.provider_event_id),
    });
    const gameByProviderId = new Map(
      games.map((game) => [game.provider_event_id, game]),
    );
    let gamesUpdated = 0;
    let gamesFinalized = 0;
    const failures: string[] = response.invalidEvents
      ? [`${response.invalidEvents} malformed provider event(s)`]
      : [];

    for (const event of response.events) {
      const game = gameByProviderId.get(event.id);
      if (!game) continue;
      const scores = scoresForEvent(event);
      if (!scores) continue;
      const existingResult = first(game.game_results);
      if (event.completed && existingResult?.source === "commissioner")
        continue;
      const unchanged =
        game.away_score === scores.awayScore &&
        game.home_score === scores.homeScore &&
        game.status === (event.completed ? "final" : "live");
      if (unchanged) continue;

      try {
        if (event.completed) {
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
          gamesFinalized += 1;
        } else {
          const { error: updateError } = await admin
            .from("games")
            .update({
              away_score: scores.awayScore,
              home_score: scores.homeScore,
              status: "live",
              status_detail: "Live",
              score_provider_updated_at: event.last_update,
            })
            .eq("id", game.id);
          if (updateError) throw updateError;
        }
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
      includeCompleted,
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

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function latestKnownQuota(admin: SupabaseClient) {
  const [{ data: score }, { data: odds }] = await Promise.all([
    admin
      .from("score_ingestion_runs")
      .select("quota_remaining, requested_at")
      .not("quota_remaining", "is", null)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("odds_ingestion_runs")
      .select("quota_remaining, requested_at")
      .not("quota_remaining", "is", null)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const values = [
    score && {
      remaining: score.quota_remaining as number,
      at: score.requested_at as string,
    },
    odds && {
      remaining: odds.quota_remaining as number,
      at: odds.requested_at as string,
    },
  ].filter(Boolean) as Array<{ remaining: number; at: string }>;
  values.sort((a, b) => b.at.localeCompare(a.at));
  return values[0]?.remaining ?? null;
}
