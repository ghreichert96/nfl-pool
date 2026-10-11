import { NextResponse } from "next/server";

import { ingestOdds } from "@/lib/odds/ingest";
import { ensureUpcomingWeek } from "@/lib/odds/upcoming-week";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestedMode = new URL(request.url).searchParams.get("mode");
  if (
    requestedMode &&
    !["initialize", "refresh", "finalize"].includes(requestedMode)
  )
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  const admin = createAdminClient();
  const slotId = new URL(request.url).searchParams.get("slot");
  const slot = slotId
    ? await admin
        .rpc("claim_odds_slot", { target_slot_id: Number(slotId) })
        .maybeSingle<{ id: number; mode: string }>()
    : null;
  if (slot?.error)
    return NextResponse.json(
      { error: "Invalid schedule slot" },
      { status: 400 },
    );
  if (slot && !slot.data) return NextResponse.json({ ok: true, skipped: true });
  const mode =
    slot?.data?.mode ??
    new URL(request.url).searchParams.get("mode") ??
    "refresh";
  if (mode !== "refresh" && mode !== "initialize" && mode !== "finalize")
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  const apiKey = process.env.ODDS_API_KEY;
  try {
    if (!apiKey && mode !== "finalize")
      throw new Error("ODDS_API_KEY is missing");
    const initialized =
      mode === "initialize" ? await ensureUpcomingWeek(admin) : null;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: weeks, error } = await admin
      .from("pool_weeks")
      .select("id, lines_frozen_at, lines_freeze_at")
      .gte("lines_freeze_at", cutoff)
      .is("lines_frozen_at", null)
      .order("lines_freeze_at")
      .limit(2);
    if (error)
      throw new Error(`Could not select active odds weeks: ${error.message}`);
    const results = [];
    let froze = false;
    for (const week of weeks ?? []) {
      if (
        mode === "finalize" &&
        new Date(week.lines_freeze_at).getTime() > Date.now()
      )
        continue;
      const result = await ingestOdds({
        admin,
        apiKey: apiKey ?? "",
        weekId: week.id,
        triggerSource: "scheduled",
        finalize: mode === "finalize",
      });
      results.push(result);
      if (mode === "finalize") froze = true;
    }
    const failures = results.flatMap((result) => result.failures);
    if (slot?.data) {
      const completion = await admin
        .from("odds_schedule_slots")
        .update({
          completed_at:
            failures.length && mode !== "finalize"
              ? null
              : new Date().toISOString(),
          error_message: failures.join("; ").slice(0, 2000) || null,
        })
        .eq("id", slot.data.id);
      if (completion.error) throw completion.error;
    }
    return NextResponse.json(
      {
        ok: failures.length === 0,
        froze,
        initializedWeek: initialized?.week_number ?? null,
        results,
      },
      { status: failures.length ? 502 : 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "Ingestion failed";
    if (slot?.data)
      await admin
        .from("odds_schedule_slots")
        .update({ error_message: message })
        .eq("id", slot.data.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
