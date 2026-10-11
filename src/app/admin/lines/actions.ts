"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCommissioner } from "@/lib/admin";
import { ensureUpcomingWeek } from "@/lib/odds/upcoming-week";
import { ingestOdds } from "@/lib/odds/ingest";
import { createAdminClient } from "@/lib/supabase/admin";

const weekIdSchema = z.coerce.number().int().positive();
function destination(weekId: number, result: string) {
  return `/admin/lines?weekId=${weekId}&${result}=1`;
}

export async function refreshLines(formData: FormData) {
  const parsed = weekIdSchema.safeParse(formData.get("week_id"));
  if (!parsed.success) redirect("/admin/lines?error=week");
  const { supabase, poolId, userId } = await requireCommissioner();
  const { data: week } = await supabase
    .from("pool_weeks")
    .select("id, lines_frozen_at, seasons!inner(pool_id)")
    .eq("id", parsed.data)
    .eq("seasons.pool_id", poolId)
    .maybeSingle();
  if (!week) redirect("/admin/lines?error=access");
  if (week.lines_frozen_at) redirect(destination(parsed.data, "error=frozen"));
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) redirect(destination(parsed.data, "error=key"));
  try {
    const result = await ingestOdds({
      admin: createAdminClient(),
      apiKey,
      weekId: parsed.data,
      requestedBy: userId,
      triggerSource: "commissioner",
      finalize: formData.get("mode") === "finalize",
    });
    if (result.failures.length) throw new Error(result.failures.join("; "));
  } catch {
    redirect(destination(parsed.data, "error=provider"));
  }
  revalidatePath("/", "layout");
  redirect(destination(parsed.data, "refreshed"));
}

export async function toggleLinesFreeze(formData: FormData) {
  const parsed = weekIdSchema.safeParse(formData.get("week_id"));
  if (!parsed.success) redirect("/admin/lines?error=week");
  const freeze = formData.get("freeze") === "1";
  const { supabase } = await requireCommissioner();
  const { error } = await supabase.rpc("set_week_lines_frozen", {
    target_week_id: parsed.data,
    should_freeze: freeze,
  });
  if (error) redirect(destination(parsed.data, "error=freeze"));
  revalidatePath("/", "layout");
  redirect(destination(parsed.data, freeze ? "frozen" : "unfrozen"));
}

export async function initializeUpcomingLines() {
  const { poolId, userId } = await requireCommissioner();
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) redirect("/admin/lines?error=key");
  let week;
  try {
    const admin = createAdminClient();
    week = await ensureUpcomingWeek(admin, new Date(), poolId);
    if (!week) throw new Error("No upcoming week");
    const result = await ingestOdds({
      admin,
      apiKey,
      weekId: week.id,
      requestedBy: userId,
      triggerSource: "commissioner",
    });
    if (result.failures.length) throw new Error(result.failures.join("; "));
  } catch {
    redirect("/admin/lines?error=provider");
  }
  revalidatePath("/", "layout");
  redirect(`/admin/lines?week=${week.week_number}&refreshed=1`);
}

const editSchema = z.object({
  game_id: z.number().int().positive(),
  updated_at: z.string().datetime({ offset: true }).nullable(),
  away_spread: z.number().min(-99).max(99).multipleOf(0.5),
  total: z.number().positive().max(999).multipleOf(0.5),
  spread_override: z.boolean(),
  total_override: z.boolean(),
  game_type: z.enum([
    "tnf",
    "sunday",
    "snf",
    "mnf",
    "special",
    "international",
  ]),
});
export async function saveLinesBatch(weekId: number, values: unknown) {
  const { supabase } = await requireCommissioner();
  const parsed = z.array(editSchema).max(32).safeParse(values);
  if (!parsed.success)
    return {
      ok: false,
      message:
        "Check highlighted values: spreads and totals must use half-point increments.",
    };
  const { error } = await supabase.rpc("save_line_batch", {
    target_week_id: weekId,
    edits: parsed.data,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "All changes saved." };
}
