"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCommissioner } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestEspnLiveStatus } from "@/lib/espn/ingest";
import { buildGameScoreEvents } from "@/features/competition/rebuild-game-score-events";

const editsSchema = z
  .array(
    z.object({
      game_id: z.number().int().positive(),
      updated_at: z.string().datetime({ offset: true }),
      away_score: z.number().int().min(0).max(255),
      home_score: z.number().int().min(0).max(255),
    }),
  )
  .min(1)
  .max(32);

export async function saveScores(weekId: number, input: unknown) {
  const edits = editsSchema.safeParse(input);
  if (!edits.success)
    return {
      ok: false,
      message: "Enter whole-number scores between 0 and 255.",
    };
  const { supabase, poolId } = await requireCommissioner();
  const { data: week } = await supabase
    .from("pool_weeks")
    .select("id,seasons!inner(pool_id)")
    .eq("id", weekId)
    .eq("seasons.pool_id", poolId)
    .maybeSingle();
  if (!week) return { ok: false, message: "Week unavailable." };
  try {
    const { data: games, error } = await supabase
      .from("games")
      .select("id,away_team,home_team,pool_lines(away_spread,total)")
      .eq("week_id", weekId)
      .in(
        "id",
        edits.data.map((e) => e.game_id),
      );
    if (error) throw error;
    const rows = [];
    for (const edit of edits.data) {
      const game = games?.find((g) => g.id === edit.game_id);
      const line = Array.isArray(game?.pool_lines)
        ? game.pool_lines[0]
        : game?.pool_lines;
      if (!game || !line)
        return {
          ok: false,
          message: "Game or saved line unavailable. Edits retained.",
        };
      const score_rows = await buildGameScoreEvents(supabase, {
        id: game.id,
        weekId,
        weekNumber: 0,
        away: game.away_team,
        home: game.home_team,
        awaySpread: Number(line.away_spread),
        total: Number(line.total),
        awayScore: edit.away_score,
        homeScore: edit.home_score,
        status: "final",
      });
      rows.push({ ...edit, score_rows });
    }
    const result = await supabase.rpc("save_score_batch", {
      target_week_id: weekId,
      edits: rows,
    });
    if (result.error) throw result.error;
    revalidatePath("/", "layout");
    return { ok: true, message: "Final scores saved." };
  } catch (error) {
    const message =
      typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "Could not save scores.";
    return { ok: false, message: `${message} Edits retained.` };
  }
}

export async function refreshScores(weekId: number) {
  const { supabase, poolId } = await requireCommissioner();
  const { data: week } = await supabase
    .from("pool_weeks")
    .select("id,seasons!inner(pool_id)")
    .eq("id", weekId)
    .eq("seasons.pool_id", poolId)
    .maybeSingle();
  if (!week) return { ok: false, message: "Week unavailable." };
  try {
    const result = await ingestEspnLiveStatus({
      admin: createAdminClient(),
      checkWeekId: weekId,
    });
    revalidatePath("/", "layout");
    return {
      ok: result.status !== "partial",
      message:
        result.status === "skipped"
          ? "No games to update."
          : result.status === "partial"
            ? "ESPN refresh had errors. See Activity Log."
            : "Scores updated from ESPN.",
    };
  } catch {
    return {
      ok: false,
      message: "ESPN refresh failed. Saved scores retained.",
    };
  }
}
