import Link from "next/link";
import { notFound } from "next/navigation";

import type { Game, Picks } from "@/features/picks/model";
import { EMPTY_PICKS } from "@/features/picks/model";
import { PicksExperience } from "@/features/picks/picks-experience";
import { requireCommissioner } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { submitCommissionerPicks } from "../actions";

export const dynamic = "force-dynamic";

function badge(gameType: string, kickoffAt: string) {
  const named: Record<string, string> = {
    international: "INTL",
    special: "SPE",
    holiday: "HOL",
    tnf: "TNF",
    snf: "SNF",
    mnf: "MNF",
  };
  if (named[gameType]) return named[gameType];
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(kickoffAt)),
  );
  return hour < 16 ? "1 PM" : "4 PM";
}

export default async function CommissionerPickSheet({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const entryId = Number((await params).entryId);
  const requestedWeek = Number((await searchParams).week);
  if (!Number.isSafeInteger(entryId)) notFound();
  const { poolId } = await requireCommissioner();
  const admin = createAdminClient();
  const { data: entry } = await admin
    .from("pool_entries")
    .select("id, entry_code, season_id, seasons!inner(pool_id)")
    .eq("id", entryId)
    .eq("seasons.pool_id", poolId)
    .maybeSingle();
  if (!entry) notFound();
  const { data: weeks } = await admin
    .from("pool_weeks")
    .select("id, week_number, label")
    .eq("season_id", entry.season_id)
    .order("week_number");
  const week =
    (weeks ?? []).find((item) => item.id === requestedWeek) ?? weeks?.[0];
  if (!week) notFound();
  const [{ data: rows }, { data: teams }, { data: latest }] = await Promise.all(
    [
      admin
        .from("games")
        .select(
          "id, away_team, home_team, kickoff_at, venue, game_type, status, away_score, home_score, status_detail, pool_lines(away_spread,total)",
        )
        .eq("week_id", week.id)
        .order("kickoff_at"),
      admin.from("teams").select("abbreviation, name"),
      admin
        .from("weekly_submissions")
        .select("id, revision")
        .eq("entry_id", entry.id)
        .eq("week_id", week.id)
        .order("revision", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ],
  );
  const { data: savedRows } = latest
    ? await admin
        .from("picks")
        .select("game_id, kind, team, total_direction, is_best_bet")
        .eq("submission_id", latest.id)
    : { data: [] };
  const names = new Map(
    (teams ?? []).map((team) => [team.abbreviation, team.name]),
  );
  // Request-time status is intentionally dynamic for per-game kickoff locks.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const games: Game[] = (rows ?? []).flatMap((row) => {
    const line = Array.isArray(row.pool_lines)
      ? row.pool_lines[0]
      : row.pool_lines;
    if (!line) return [];
    const kickoff = new Date(row.kickoff_at);
    const status: Game["status"] =
      row.status === "final"
        ? "final"
        : kickoff.getTime() <= now
          ? "live"
          : "upcoming";
    return [
      {
        id: String(row.id),
        away: {
          abbreviation: row.away_team,
          name: names.get(row.away_team) ?? row.away_team,
        },
        home: {
          abbreviation: row.home_team,
          name: names.get(row.home_team) ?? row.home_team,
        },
        awaySpread: Number(line.away_spread),
        total: Number(line.total),
        badge: badge(row.game_type, row.kickoff_at),
        kickoff: new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        }).format(kickoff),
        location: row.venue ?? "",
        status,
        ...(row.away_score !== null && row.home_score !== null
          ? {
              score: {
                away: row.away_score,
                home: row.home_score,
                detail: row.status_detail ?? status.toUpperCase(),
              },
            }
          : {}),
      },
    ];
  });
  const initial: Picks = (savedRows ?? []).reduce<Picks>((picks, row) => {
    const gameId = String(row.game_id);
    if (row.kind === "ats" && row.team) {
      const pick = { gameId, team: row.team };
      picks.ats.push(pick);
      if (row.is_best_bet) picks.bestBet = pick;
    } else if (
      row.kind === "total" &&
      (row.total_direction === "over" || row.total_direction === "under")
    )
      picks.totals.push({ gameId, direction: row.total_direction });
    else if (row.kind === "sudden_death" && row.team)
      picks.suddenDeath = { gameId, team: row.team };
    else if (row.kind === "underdog" && row.team)
      picks.underdog = { gameId, team: row.team };
    return picks;
  }, structuredClone(EMPTY_PICKS));

  return (
    <div className="relative">
      <Link
        href="/admin/picks"
        className="fixed right-3 top-14 z-50 rounded-md border border-amber-500 bg-slate-950 px-3 py-2 text-xs font-black text-amber-200"
      >
        EXIT ADMIN PICKS
      </Link>
      <PicksExperience
        games={games}
        initialPicks={initial}
        draftTarget={{ entryId: entry.id, weekId: week.id }}
        entryCode={entry.entry_code}
        weekNumber={week.week_number}
        submitAction={submitCommissionerPicks}
      />
    </div>
  );
}
