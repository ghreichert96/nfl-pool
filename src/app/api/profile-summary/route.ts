import { NextResponse } from "next/server";

import { loadCompetition } from "@/features/competition/data";
import { sideOrder } from "@/features/competition/performance";
import { gamesBack, ranksByGamesBack } from "@/features/competition/scoring";
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
  if (!standing) return NextResponse.json({ summary: null });
  const rankLabel = (rank: number | undefined) =>
    rank === undefined ? "—" : `#${rank}`;
  const mainRank = ranksByGamesBack(data.standings).get(entry.id);
  const udRank = sideOrder(data.standings, data.entries, "ud").ranks.get(
    entry.id,
  );
  const suddenDeath = (number: number) => {
    const contest = data.sdContests.find((item) => item.number === number);
    if (!contest?.started || !contest.participantIds.includes(entry.id))
      return "—";
    const entrants = data.entries.filter((item) =>
      contest.participantIds.includes(item.id),
    );
    const rank = sideOrder(contest.standings, entrants, "sd").ranks.get(
      entry.id,
    );
    const strikes = contest.standings.find(
      (item) => item.entryId === entry.id,
    )?.suddenDeathStrikes;
    return `${rankLabel(rank)} · ${strikes ?? 0}/${contest.strike_limit}`;
  };
  return NextResponse.json({
    summary: {
      entryCode: entry.entry_code,
      record: `${standing.wins}-${standing.losses}-${standing.ties}`,
      gamesBack: gamesBack(standing, data.standings).toFixed(1),
      pools: [
        {
          label: "Main Rank",
          standing: rankLabel(mainRank),
          payout: formatMoney(financial?.main ?? 0),
        },
        {
          label: "UD Pts",
          standing: `${standing.underdogPoints.toFixed(1)} · ${rankLabel(udRank)}`,
          payout: formatMoney(financial?.ud ?? 0),
        },
        {
          label: "SD1",
          standing: suddenDeath(1),
          payout: formatMoney(financial?.sd ?? 0),
        },
        {
          label: "SD2",
          standing: suddenDeath(2),
          payout: formatMoney(financial?.sd2 ?? 0),
        },
      ],
      totalPayout: formatMoney(financial?.net ?? 0),
    },
  });
}

function formatMoney(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}$${Math.abs(value).toFixed(value % 1 ? 2 : 0)}`;
}
