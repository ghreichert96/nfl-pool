"use server";

import type { Picks } from "@/features/picks/model";
import { picksSchema, toSubmissionPicks } from "@/features/picks/submission";
import { requireCommissioner } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

type SubmissionTarget = { entryId: number; weekId: number };

export async function submitCommissionerPicks(
  target: SubmissionTarget,
  input: Picks,
) {
  const entryId = Number(target.entryId);
  const weekId = Number(target.weekId);
  const parsed = picksSchema.safeParse(input);
  if (
    !Number.isSafeInteger(entryId) ||
    !Number.isSafeInteger(weekId) ||
    !parsed.success
  )
    return { ok: false as const, message: "Invalid picks" };

  const { poolId } = await requireCommissioner();
  const admin = createAdminClient();
  const { data: entry } = await admin
    .from("pool_entries")
    .select("id, season_id, seasons!inner(pool_id)")
    .eq("id", entryId)
    .eq("seasons.pool_id", poolId)
    .maybeSingle();
  const { data: week } = await admin
    .from("pool_weeks")
    .select("id, season_id")
    .eq("id", weekId)
    .maybeSingle();
  if (!entry || !week || entry.season_id !== week.season_id)
    return { ok: false as const, message: "Entry and week do not match" };

  const { data: games } = await admin
    .from("games")
    .select("id, away_team, home_team, kickoff_at")
    .eq("week_id", weekId);
  const gameMap = new Map((games ?? []).map((game) => [game.id, game]));
  const requested = toSubmissionPicks(parsed.data).map((pick) => ({
    game_id: Number(pick.gameId),
    kind: pick.kind,
    team: pick.team,
    total_direction: pick.totalDirection,
    is_best_bet: pick.isBestBet,
  }));
  if (
    requested.some((pick) => {
      const game = gameMap.get(pick.game_id);
      return (
        !game ||
        (pick.team !== null &&
          pick.team !== game.away_team &&
          pick.team !== game.home_team)
      );
    })
  )
    return { ok: false as const, message: "A pick references the wrong week" };

  const { data: latest } = await admin
    .from("weekly_submissions")
    .select("id, revision")
    .eq("entry_id", entryId)
    .eq("week_id", weekId)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: previousPicks } = latest
    ? await admin
        .from("picks")
        .select("game_id, kind, team, total_direction, is_best_bet")
        .eq("submission_id", latest.id)
    : { data: [] };
  const now = Date.now();
  const locked = (previousPicks ?? []).filter(
    (pick) =>
      new Date(gameMap.get(pick.game_id)?.kickoff_at ?? 0).getTime() <= now,
  );
  const unlocked = requested.filter(
    (pick) =>
      new Date(gameMap.get(pick.game_id)?.kickoff_at ?? 0).getTime() > now,
  );
  const finalPicks = [...locked, ...unlocked];

  const { data: submission, error: submissionError } = await admin
    .from("weekly_submissions")
    .insert({
      entry_id: entryId,
      week_id: weekId,
      revision: (latest?.revision ?? 0) + 1,
    })
    .select("id")
    .single();
  if (submissionError || !submission)
    return { ok: false as const, message: "Could not create submission" };
  const { error: picksError } = finalPicks.length
    ? await admin
        .from("picks")
        .insert(
          finalPicks.map((pick) => ({ ...pick, submission_id: submission.id })),
        )
    : { error: null };
  if (picksError) {
    await admin.from("weekly_submissions").delete().eq("id", submission.id);
    return { ok: false as const, message: "Picks failed validation" };
  }
  return { ok: true as const, message: "Commissioner revision submitted" };
}
