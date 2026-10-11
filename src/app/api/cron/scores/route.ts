import { ingestScores } from "@/lib/scores/ingest";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

// ESPN owns automatic scoring. Odds API checks are commissioner-initiated
// server actions in Admin > Scores; retired cron callers cannot spend credits.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mode = new URL(request.url).searchParams.get("mode");
  if (mode && !["live", "validate", "reconcile"].includes(mode))
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  if (new URL(request.url).searchParams.get("manual") === "1") {
    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey)
      return NextResponse.json(
        { error: "ODDS_API_KEY is missing" },
        { status: 503 },
      );
    try {
      const result = await ingestScores({
        admin: createAdminClient(),
        apiKey,
        mode: mode === "reconcile" ? "reconcile" : "validate",
      });
      revalidatePath("/", "layout");
      return NextResponse.json({ ok: true, result });
    } catch {
      return NextResponse.json(
        { error: "Manual score check failed" },
        { status: 500 },
      );
    }
  }
  return NextResponse.json(
    {
      error:
        "Automatic Odds API scoring is disabled. Use Admin > Scores for a manual check.",
    },
    { status: 410 },
  );
}
