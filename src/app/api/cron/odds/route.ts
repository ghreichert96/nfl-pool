import { NextResponse } from "next/server";

import { ingestOdds } from "@/lib/odds/ingest";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      { error: "ODDS_API_KEY is missing" },
      { status: 503 },
    );
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: weeks, error } = await admin
    .from("pool_weeks")
    .select("id, lines_frozen_at, seasons!inner(status)")
    .gte("lines_freeze_at", cutoff)
    .is("lines_frozen_at", null)
    .in("seasons.status", ["setup", "open", "active"])
    .order("lines_freeze_at")
    .limit(2);
  if (error)
    return NextResponse.json(
      { error: "Could not select active weeks" },
      { status: 500 },
    );
  const results = [];
  for (const week of weeks ?? [])
    results.push(
      await ingestOdds({
        admin,
        apiKey,
        weekId: week.id,
        triggerSource: "scheduled",
      }),
    );
  return NextResponse.json({ ok: true, results });
}
