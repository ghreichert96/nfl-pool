import { NextResponse } from "next/server";

import { ingestOdds } from "@/lib/odds/ingest";
import { ensureUpcomingWeek } from "@/lib/odds/upcoming-week";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mode = new URL(request.url).searchParams.get("mode") ?? "refresh";
  if (mode !== "refresh" && mode !== "initialize" && mode !== "finalize")
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
    .select("id, lines_frozen_at, lines_freeze_at")
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
  let froze = false;
  for (const week of weeks ?? []) {
    if (
      mode === "finalize" &&
      new Date(week.lines_freeze_at).getTime() > Date.now()
    )
      continue;
    const result = await ingestOdds({
      admin,
      apiKey,
      weekId: week.id,
      triggerSource: "scheduled",
      finalize: mode === "finalize",
    });
    results.push(result);
    if (mode === "finalize") froze = true;
  }
  return NextResponse.json({
    ok: true,
    froze,
    initializedWeek: initialized?.week_number ?? null,
    results,
  });
}
