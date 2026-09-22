import type { SupabaseClient } from "@supabase/supabase-js";

import { nextWeeklyFreeze } from "@/lib/eastern-time";

type PoolWeek = {
  id: number;
  season_id: number;
  week_number: number;
  lines_freeze_at: string;
};

export function upcomingWeekNumber(weeks: PoolWeek[], now: Date) {
  const ordered = [...weeks].sort(
    (left, right) => left.week_number - right.week_number,
  );
  const past = ordered
    .filter((week) => new Date(week.lines_freeze_at) <= now)
    .at(-1);
  if (!past) return ordered[0]?.week_number ?? null;
  return past.week_number < 18 ? past.week_number + 1 : null;
}

export async function ensureUpcomingWeek(
  admin: SupabaseClient,
  now = new Date(),
  poolId?: number,
) {
  let seasonQuery = admin
    .from("seasons")
    .select("id")
    .in("status", ["setup", "open", "active"])
    .order("year", { ascending: false })
    .limit(1);
  if (poolId !== undefined) seasonQuery = seasonQuery.eq("pool_id", poolId);
  const { data: season, error: seasonError } = await seasonQuery.maybeSingle();
  if (seasonError) throw seasonError;
  if (!season) return null;

  const { data, error } = await admin
    .from("pool_weeks")
    .select("id, season_id, week_number, lines_freeze_at")
    .eq("season_id", season.id)
    .order("week_number");
  if (error) throw error;
  const weeks = (data ?? []) as PoolWeek[];
  const targetNumber = upcomingWeekNumber(weeks, now);
  if (targetNumber === null) return null;
  const existing = weeks.find((week) => week.week_number === targetNumber);
  if (existing) return existing;

  const previous = weeks.find((week) => week.week_number === targetNumber - 1);
  if (!previous) return null;
  const { data: created, error: createError } = await admin
    .from("pool_weeks")
    .upsert(
      {
        season_id: season.id,
        week_number: targetNumber,
        label: `Week ${targetNumber}`,
        lines_freeze_at: nextWeeklyFreeze(previous.lines_freeze_at),
      },
      { onConflict: "season_id,week_number", ignoreDuplicates: true },
    )
    .select("id, season_id, week_number, lines_freeze_at")
    .maybeSingle();
  if (createError) throw createError;
  if (created) return created as PoolWeek;
  const { data: concurrent, error: concurrentError } = await admin
    .from("pool_weeks")
    .select("id, season_id, week_number, lines_freeze_at")
    .eq("season_id", season.id)
    .eq("week_number", targetNumber)
    .single();
  if (concurrentError) throw concurrentError;
  return concurrent as PoolWeek;
}
