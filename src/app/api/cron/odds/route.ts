import { NextResponse } from "next/server";

import { ingestOdds } from "@/lib/odds/ingest";
import { ensureUpcomingWeek } from "@/lib/odds/upcoming-week";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mode = new URL(request.url).searchParams.get("mode") ?? "refresh";
  if (mode !== "refresh" && mode !== "initialize")
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      { error: "ODDS_API_KEY is missing" },
      { status: 503 },
    );
  const admin = createAdminClient();
  const initialized =
    mode === "initialize" ? await ensureUpcomingWeek(admin) : null;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: weeks, error } = await admin
    .from("pool_weeks")
    .select("id, lines_frozen_at")
    .gte("lines_freeze_at", cutoff)
    .is("lines_frozen_at", null)
    .order("lines_freeze_at")
    .limit(2);
  if (error) {
    console.error("Could not select active odds weeks", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      { error: "Could not select active weeks" },
      { status: 500 },
    );
  }
  const results = [];
  const shouldFreeze = isThursdayFreezeWindow(new Date());
  for (const week of weeks ?? []) {
    const result = await ingestOdds({
      admin,
      apiKey,
      weekId: week.id,
      triggerSource: "scheduled",
    });
    results.push(result);
    if (shouldFreeze) {
      const frozenAt = new Date().toISOString();
      const { data: frozenWeek, error: freezeError } = await admin
        .from("pool_weeks")
        .update({ lines_frozen_at: frozenAt, lines_frozen_by: null })
        .eq("id", week.id)
        .is("lines_frozen_at", null)
        .select("id")
        .maybeSingle();
      if (freezeError) throw freezeError;
      if (frozenWeek) {
        const { error: auditError } = await admin
          .from("line_audit_events")
          .insert({
            week_id: week.id,
            event_type: "freeze",
            source: "system",
            was_frozen: false,
            note: "Automatic freeze after Thursday 8 PM ET odds pull",
          });
        if (auditError) throw auditError;
      }
    }
  }
  return NextResponse.json({
    ok: true,
    froze: shouldFreeze,
    initializedWeek: initialized?.week_number ?? null,
    results,
  });
}

function isThursdayFreezeWindow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return (
    parts.find((part) => part.type === "weekday")?.value === "Thu" &&
    parts.find((part) => part.type === "hour")?.value === "20"
  );
}
