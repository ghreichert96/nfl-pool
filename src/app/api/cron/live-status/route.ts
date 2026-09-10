import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { ingestEspnLiveStatus } from "@/lib/espn/ingest";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await ingestEspnLiveStatus({ admin: createAdminClient() });
    if (result.status !== "skipped") {
      revalidatePath("/");
      revalidatePath("/grid");
      revalidatePath("/standings");
      revalidatePath("/account");
      revalidatePath("/admin");
    }
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("ESPN live-status ingestion failed", error);
    return NextResponse.json(
      { error: "Live-status ingestion failed" },
      { status: 500 },
    );
  }
}
