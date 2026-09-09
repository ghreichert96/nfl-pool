import { NextResponse } from "next/server";

import { loadCompetition } from "@/features/competition/data";
import { getPoolContext } from "@/lib/pool-context";

export async function GET() {
  const { supabase, entry } = await getPoolContext();
  if (!entry) return NextResponse.json({ summary: null });
  const { data: latestWeek } = await supabase
    .from("pool_weeks")
    .select("week_number")
    .eq("season_id", entry.season_id)
    .not("published_at", "is", null)
    .order("week_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const data = await loadCompetition(
    supabase,
    entry.season_id,
    latestWeek?.week_number,
  );
  const main = data.standings.findIndex((item) => item.entryId === entry.id);
  const ud = [...data.standings]
    .sort((a, b) => b.underdogPoints - a.underdogPoints)
    .findIndex((item) => item.entryId === entry.id);
  const standing = data.standings.find((item) => item.entryId === entry.id);
  return NextResponse.json({
    summary: {
      count: data.entries.length,
      mainRank: main + 1,
      udRank: ud + 1,
      sdRemaining: Math.max(0, 2 - (standing?.suddenDeathStrikes ?? 0)),
    },
  });
}
