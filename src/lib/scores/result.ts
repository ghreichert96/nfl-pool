import type { SupabaseClient } from "@supabase/supabase-js";

import { rebuildGameScoreEvents } from "@/features/competition/rebuild-game-score-events";
import type { ScoringGame } from "@/features/competition/scoring";

export function deriveGameResult(
  game: Pick<ScoringGame, "away" | "home" | "awaySpread" | "total">,
  awayScore: number,
  homeScore: number,
) {
  const atsAway = awayScore + game.awaySpread;
  const totalScore = awayScore + homeScore;
  return {
    atsWinner:
      atsAway === homeScore
        ? null
        : atsAway > homeScore
          ? game.away
          : game.home,
    totalWinner:
      totalScore === game.total
        ? null
        : totalScore > game.total
          ? ("over" as const)
          : ("under" as const),
    outrightWinner:
      awayScore === homeScore
        ? null
        : awayScore > homeScore
          ? game.away
          : game.home,
  };
}

export async function saveFinalGameResult({
  supabase,
  game,
  source,
  recordedBy = null,
  providerUpdatedAt = null,
  isCorrection = false,
}: {
  supabase: SupabaseClient;
  game: ScoringGame;
  source: "commissioner" | "provider";
  recordedBy?: string | null;
  providerUpdatedAt?: string | null;
  isCorrection?: boolean;
}) {
  if (game.awayScore === null || game.homeScore === null)
    throw new Error("A final result requires both scores");
  const result = deriveGameResult(game, game.awayScore, game.homeScore);
  const now = new Date().toISOString();
  const { error: resultError } = await supabase.from("game_results").upsert({
    game_id: game.id,
    away_score: game.awayScore,
    home_score: game.homeScore,
    ats_winner: result.atsWinner,
    total_winner: result.totalWinner,
    outright_winner: result.outrightWinner,
    source,
    recorded_by: recordedBy,
    provider_updated_at: providerUpdatedAt,
    corrected_at: isCorrection ? now : null,
  });
  if (resultError) throw resultError;

  const { error: gameError } = await supabase
    .from("games")
    .update({
      away_score: game.awayScore,
      home_score: game.homeScore,
      status: "final",
      status_detail: "Final",
      live_state: "final",
      final_validation_state: "validated",
      final_validation_next_at: null,
      final_validation_error: null,
      score_provider_updated_at: providerUpdatedAt,
    })
    .eq("id", game.id);
  if (gameError) throw gameError;

  return rebuildGameScoreEvents(supabase, { ...game, status: "final" });
}
