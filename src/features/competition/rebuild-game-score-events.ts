import type { SupabaseClient } from "@supabase/supabase-js";

import { pickOutcome, type ScoringGame, type ScoringPick } from "./scoring";

export async function rebuildGameScoreEvents(
  supabase: SupabaseClient,
  game: ScoringGame,
) {
  const { data: submissions, error: submissionError } = await supabase
    .from("weekly_submissions")
    .select("id, entry_id, revision")
    .eq("week_id", game.weekId)
    .order("revision", { ascending: false });
  if (submissionError) throw submissionError;

  const latest = new Map<number, number>();
  for (const item of submissions ?? [])
    if (!latest.has(item.entry_id)) latest.set(item.entry_id, item.id);

  const ids = [...latest.values()];
  const { data: rows, error: pickError } = ids.length
    ? await supabase
        .from("picks")
        .select(
          "id, submission_id, game_id, kind, team, total_direction, is_best_bet",
        )
        .in("submission_id", ids)
        .eq("game_id", game.id)
    : { data: [], error: null };
  if (pickError) throw pickError;

  const { error: deleteError } = await supabase
    .from("score_events")
    .delete()
    .eq("game_id", game.id);
  if (deleteError) throw deleteError;

  const entryBySubmission = new Map(
    [...latest].map(([entryId, submissionId]) => [submissionId, entryId]),
  );
  const events = (rows ?? []).flatMap((row) => {
    const entryId = entryBySubmission.get(row.submission_id);
    if (!entryId) return [];
    const pick: ScoringPick = {
      entryId,
      gameId: row.game_id,
      kind: row.kind as ScoringPick["kind"],
      team: row.team,
      totalDirection: row.total_direction as ScoringPick["totalDirection"],
      isBestBet: row.is_best_bet,
    };
    const outcome = pickOutcome(game, pick);
    const base = {
      entry_id: entryId,
      week_id: game.weekId,
      game_id: game.id,
      pick_id: row.id,
      outcome,
      scoring_revision: 1,
    };
    const value =
      pick.kind === "underdog" && outcome === "win"
        ? Math.abs(pick.team === game.away ? game.awaySpread : -game.awaySpread)
        : pick.kind === "ats" || pick.kind === "total"
          ? outcome === "win"
            ? 1
            : outcome === "loss"
              ? -1
              : 0
          : 0;
    return [
      {
        ...base,
        kind: pick.kind,
        decision_value: value,
        strike_delta:
          pick.kind === "sudden_death" && outcome === "loss" ? 1 : 0,
      },
      ...(pick.isBestBet
        ? [
            {
              ...base,
              kind: "best_bet",
              decision_value: value,
              strike_delta: 0,
            },
          ]
        : []),
    ];
  });

  if (events.length) {
    const { error } = await supabase.from("score_events").insert(events);
    if (error) throw error;
  }
  return events.length;
}
