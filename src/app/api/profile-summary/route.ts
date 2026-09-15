import { NextResponse } from "next/server";

import { loadCompetition } from "@/features/competition/data";
import { gamesBack } from "@/features/competition/scoring";
import { getPoolContext } from "@/lib/pool-context";
import { selectPoolWeek } from "@/lib/pool-weeks";

export async function GET() {
  const { supabase, entry } = await getPoolContext();
  if (!entry) return NextResponse.json({ summary: null });
  const { data: weeks } = await supabase
    .from("pool_weeks")
    .select("week_number, lines_freeze_at")
    .eq("season_id", entry.season_id)
    .not("published_at", "is", null)
    .order("week_number");
  const currentWeek = selectPoolWeek(weeks ?? [], Number.NaN);
  const data = await loadCompetition(
    supabase,
    entry.season_id,
    currentWeek?.week_number,
    { includeComments: false, includeTeams: false },
  );
  const standing = data.standings.find((item) => item.entryId === entry.id);
  const financial = data.financials.get(entry.id);
  return NextResponse.json({
    summary: standing
      ? {
          record: `${standing.wins}-${standing.losses}-${standing.ties}`,
          gamesBack: gamesBack(standing, data.standings).toFixed(1),
          underdogPoints: standing.underdogPoints.toFixed(1),
          suddenDeath: `${standing.suddenDeathStrikes}/2`,
          mainDollars: formatMoney(financial?.main ?? 0),
          netDollars: formatMoney(financial?.net ?? 0),
        }
      : null,
  });
}

function formatMoney(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}$${Math.abs(value).toFixed(value % 1 ? 2 : 0)}`;
}
