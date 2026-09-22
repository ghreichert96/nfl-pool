"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCommissioner } from "@/lib/admin";
import { ensureUpcomingWeek } from "@/lib/odds/upcoming-week";
import { ingestOdds } from "@/lib/odds/ingest";
import { createAdminClient } from "@/lib/supabase/admin";

const weekIdSchema = z.coerce.number().int().positive();
const lineSchema = z.object({
  lineId: z.coerce.number().int().positive(),
  weekId: weekIdSchema,
  awaySpread: z.coerce.number().min(-99).max(99),
  total: z.coerce.number().positive().max(999),
});

function destination(weekId: number, result: string) {
  return `/admin/lines?week=${weekId}&${result}=1`;
}

export async function saveLine(formData: FormData) {
  const parsed = lineSchema.safeParse({
    lineId: formData.get("line_id"),
    weekId: formData.get("week_id"),
    awaySpread: formData.get("away_spread"),
    total: formData.get("total"),
  });
  if (!parsed.success) redirect("/admin/lines?error=invalid");
  const { supabase, poolId } = await requireCommissioner();
  const { data: permittedLine } = await supabase
    .from("pool_lines")
    .select(
      "id, games!inner(week_id, pool_weeks!inner(season_id, seasons!inner(pool_id)))",
    )
    .eq("id", parsed.data.lineId)
    .eq("games.week_id", parsed.data.weekId)
    .eq("games.pool_weeks.seasons.pool_id", poolId)
    .maybeSingle();
  if (!permittedLine) redirect("/admin/lines?error=access");
  const { error } = await supabase
    .from("pool_lines")
    .update({
      away_spread: parsed.data.awaySpread,
      total: parsed.data.total,
      source: "commissioner",
      override_reason: "Manual commissioner adjustment",
      frozen_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.lineId);
  if (error) redirect(destination(parsed.data.weekId, "error=line"));

  revalidatePath("/", "layout");
  redirect(destination(parsed.data.weekId, "saved"));
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
    await ingestOdds({
      admin: createAdminClient(),
      apiKey,
      weekId: parsed.data,
      requestedBy: userId,
      triggerSource: "commissioner",
      finalize: formData.get("mode") === "finalize",
    });
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
    await ingestOdds({
      admin,
      apiKey,
      weekId: week.id,
      requestedBy: userId,
      triggerSource: "commissioner",
    });
  } catch {
    redirect("/admin/lines?error=provider");
  }
  revalidatePath("/", "layout");
  redirect(`/admin/lines?week=${week.week_number}&refreshed=1`);
}
