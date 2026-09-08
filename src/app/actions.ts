"use server";

import { picksSchema, toSubmissionPicks } from "@/features/picks/submission";
import type { Picks } from "@/features/picks/model";
import { createClient } from "@/lib/supabase/server";

type SubmissionTarget = { entryId: number; weekId: number };

export async function submitWeeklyPicks(
  target: SubmissionTarget,
  input: Picks,
) {
  const parsedTarget = {
    entryId: Number(target.entryId),
    weekId: Number(target.weekId),
  };
  const parsedPicks = picksSchema.safeParse(input);
  if (
    !Number.isSafeInteger(parsedTarget.entryId) ||
    !Number.isSafeInteger(parsedTarget.weekId) ||
    !parsedPicks.success
  ) {
    return { ok: false as const, message: "Invalid picks" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_weekly_picks", {
    target_entry_id: parsedTarget.entryId,
    target_week_id: parsedTarget.weekId,
    new_picks: toSubmissionPicks(parsedPicks.data).map((pick) => ({
      game_id: Number(pick.gameId),
      kind: pick.kind,
      team: pick.team,
      total_direction: pick.totalDirection,
      is_best_bet: pick.isBestBet,
    })),
  });

  return error
    ? { ok: false as const, message: "Submission failed" }
    : { ok: true as const, message: "Picks submitted" };
}
