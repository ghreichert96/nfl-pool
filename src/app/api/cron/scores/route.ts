import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { ingestScores } from "@/lib/scores/ingest";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

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

  const mode = new URL(request.url).searchParams.get("mode");
  if (mode !== null && mode !== "live" && mode !== "reconcile")
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });

  try {
    const result = await ingestScores({
      admin: createAdminClient(),
      apiKey,
      mode: mode === "reconcile" ? "reconcile" : "live",
    });
    if (result.status !== "skipped") {
      revalidatePath("/grid");
      revalidatePath("/standings");
      revalidatePath("/account");
      revalidatePath("/admin");
    }
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Score ingestion failed", error);
    return NextResponse.json(
      { error: "Score ingestion failed" },
      { status: 500 },
    );
  }
}
