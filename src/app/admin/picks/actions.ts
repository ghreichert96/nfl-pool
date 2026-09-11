"use server";

import { revalidatePath } from "next/cache";

import { rebuildGameScoreEvents } from "@/features/competition/rebuild-game-score-events";
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

  const { poolId, userId } = await requireCommissioner();
  const admin = createAdminClient();
  const { data: entry } = await admin
    .from("pool_entries")
    .select("id, season_id, seasons!inner(pool_id)")
    .eq("id", entryId)
    .eq("seasons.pool_id", poolId)
    .maybeSingle();
  const { data: week } = await admin
    .from("pool_weeks")
    .select("id, season_id, week_number")
    .eq("id", weekId)
    .maybeSingle();
  if (!entry || !week || entry.season_id !== week.season_id)
    return { ok: false as const, message: "Entry and week do not match" };

  const { data: games } = await admin
    .from("games")
    .select(
      "id, away_team, home_team, kickoff_at, status, away_score, home_score, pool_lines(away_spread,total)",
    )
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
  const finalPicks = requested;

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
  const { error: auditError } = await admin
    .from("commissioner_audit_events")
    .insert({
      pool_id: poolId,
      actor_id: userId,
      action: "entrant_picks_overridden",
      entity_type: "weekly_submission",
      entity_id: String(submission.id),
      details: {
        entry_id: entryId,
        week_id: weekId,
        revision: (latest?.revision ?? 0) + 1,
        previous_picks: previousPicks ?? [],
        replacement_picks: finalPicks,
      },
    });
  if (auditError) {
    await admin.from("weekly_submissions").delete().eq("id", submission.id);
    return { ok: false as const, message: "Revision could not be audited" };
  }

  for (const game of games ?? []) {
    const line = Array.isArray(game.pool_lines)
      ? game.pool_lines[0]
      : game.pool_lines;
    if (
      game.status !== "final" ||
      game.away_score === null ||
      game.home_score === null ||
      !line
    )
      continue;
    await rebuildGameScoreEvents(admin, {
      id: game.id,
      weekId,
      weekNumber: week.week_number,
      away: game.away_team,
      home: game.home_team,
      awaySpread: Number(line.away_spread),
      total: Number(line.total),
      awayScore: game.away_score,
      homeScore: game.home_score,
      status: "final",
    });
  }
  revalidatePath("/admin/picks");
  revalidatePath(`/admin/picks/${entryId}`);
  revalidatePath("/grid");
  revalidatePath("/standings");
  return { ok: true as const, message: "Commissioner revision submitted" };
}
