import type { SupabaseClient } from "@supabase/supabase-js";

import { buildGameScoreEvents } from "@/features/competition/rebuild-game-score-events";
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
  const events = await buildGameScoreEvents(supabase, {
    ...game,
    status: "final",
  });
  const { data, error } = await supabase.rpc("save_final_game_result", {
    target_game_id: game.id,
    away_points: game.awayScore,
    home_points: game.homeScore,
    result_source: source,
    provider_time: providerUpdatedAt,
    correction: isCorrection,
    score_rows: events,
    actor: recordedBy,
  });
  if (error) throw error;
  return Number(data);
}
