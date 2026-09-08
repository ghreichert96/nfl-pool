import type { SupabaseClient } from "@supabase/supabase-js";

import { consensusLine } from "./consensus";
import { fetchNflOdds } from "./provider";

const teamCodes: Record<string, string> = {
  "Arizona Cardinals": "ARI",
  "Atlanta Falcons": "ATL",
  "Baltimore Ravens": "BAL",
  "Buffalo Bills": "BUF",
  "Carolina Panthers": "CAR",
  "Chicago Bears": "CHI",
  "Cincinnati Bengals": "CIN",
  "Cleveland Browns": "CLE",
  "Dallas Cowboys": "DAL",
  "Denver Broncos": "DEN",
  "Detroit Lions": "DET",
  "Green Bay Packers": "GB",
  "Houston Texans": "HOU",
  "Indianapolis Colts": "IND",
  "Jacksonville Jaguars": "JAX",
  "Kansas City Chiefs": "KC",
  "Los Angeles Chargers": "LAC",
  "Los Angeles Rams": "LAR",
  "Las Vegas Raiders": "LV",
  "Miami Dolphins": "MIA",
  "Minnesota Vikings": "MIN",
  "New England Patriots": "NE",
  "New Orleans Saints": "NO",
  "New York Giants": "NYG",
  "New York Jets": "NYJ",
  "Philadelphia Eagles": "PHI",
  "Pittsburgh Steelers": "PIT",
  "San Francisco 49ers": "SF",
  "Seattle Seahawks": "SEA",
  "Tampa Bay Buccaneers": "TB",
  "Tennessee Titans": "TEN",
  "Washington Commanders": "WAS",
};

export async function ingestOdds({
  admin,
  apiKey,
  weekId,
  requestedBy = null,
  triggerSource,
}: {
  admin: SupabaseClient;
  apiKey: string;
  weekId: number;
  requestedBy?: string | null;
  triggerSource: "scheduled" | "commissioner";
}) {
  const { data: run, error: runError } = await admin
    .from("odds_ingestion_runs")
    .insert({
      week_id: weekId,
      trigger_source: triggerSource,
      requested_by: requestedBy,
      status: "running",
    })
    .select("id")
    .single();
  if (runError || !run) throw new Error("Could not create ingestion run");
  try {
    const { data: week } = await admin
      .from("pool_weeks")
      .select("lines_frozen_at, lines_freeze_at")
      .eq("id", weekId)
      .single();
    if (!week) throw new Error("Pool week was not found");
    const freezeAt = new Date(week.lines_freeze_at).getTime();
    const { events, quota } = await fetchNflOdds(apiKey, {
      // Opening-week and holiday games can precede Thursday. Keep the pull
      // centered on the pool's freeze while covering the full weekly slate.
      from: new Date(
        Math.max(Date.now(), freezeAt - 3 * 24 * 60 * 60 * 1000),
      ).toISOString(),
      to: new Date(freezeAt + 5 * 24 * 60 * 60 * 1000).toISOString(),
    });
    let snapshotsWritten = 0;
    for (const event of events) {
      const away = teamCodes[event.away_team];
      const home = teamCodes[event.home_team];
      if (!away || !home) continue;
      const { data: existing } = await admin
        .from("games")
        .select("id, week_id")
        .eq("provider_event_id", event.id)
        .maybeSingle();
      if (existing && existing.week_id !== weekId) continue;
      const { data: game, error: gameError } = await admin
        .from("games")
        .upsert(
          {
            ...(existing ? { id: existing.id } : {}),
            week_id: weekId,
            provider_event_id: event.id,
            away_team: away,
            home_team: home,
            kickoff_at: event.commence_time,
            game_type: gameType(event.commence_time),
            status: "scheduled",
          },
          { onConflict: "provider_event_id" },
        )
        .select("id, line_lock_at")
        .single();
      if (gameError || !game) continue;
      const snapshots = event.bookmakers.flatMap((book) =>
        book.markets.flatMap((market) =>
          market.outcomes.map((outcome) => ({
            run_id: run.id,
            game_id: game.id,
            provider_event_id: event.id,
            bookmaker_key: book.key,
            bookmaker_name: book.title,
            market: market.key,
            outcome_name: outcome.name,
            point: outcome.point,
            price: outcome.price ?? null,
            provider_updated_at: book.last_update ?? null,
          })),
        ),
      );
      if (snapshots.length) {
        const { error } = await admin.from("odds_snapshots").insert(snapshots);
        if (!error) snapshotsWritten += snapshots.length;
      }
      if (
        !week?.lines_frozen_at &&
        new Date(game.line_lock_at).getTime() > Date.now()
      ) {
        const consensus = consensusLine({
          spreads: event.bookmakers.flatMap((book) =>
            book.markets
              .filter((market) => market.key === "spreads")
              .flatMap((market) =>
                market.outcomes
                  .filter((outcome) => outcome.name === event.away_team)
                  .map((outcome) => ({
                    bookmaker: book.key,
                    point: outcome.point,
                  })),
              ),
          ),
          totals: event.bookmakers.flatMap((book) =>
            book.markets
              .filter((market) => market.key === "totals")
              .flatMap((market) =>
                market.outcomes
                  .filter((outcome) => outcome.name.toLowerCase() === "over")
                  .map((outcome) => ({
                    bookmaker: book.key,
                    point: outcome.point,
                  })),
              ),
          ),
        });
        if (consensus.awaySpread !== null && consensus.total !== null)
          await admin.from("pool_lines").upsert(
            {
              game_id: game.id,
              away_spread: consensus.awaySpread,
              total: consensus.total,
              source: "consensus",
              consensus_away_spread: consensus.awaySpread,
              consensus_total: consensus.total,
              override_reason: null,
              frozen_at: new Date().toISOString(),
            },
            { onConflict: "game_id" },
          );
      }
    }
    await admin
      .from("odds_ingestion_runs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        events_received: events.length,
        snapshots_written: snapshotsWritten,
        quota_remaining: quota.remaining,
      })
      .eq("id", run.id);
    if (events.length > 0 && snapshotsWritten > 0)
      await admin
        .from("pool_weeks")
        .update({ published_at: new Date().toISOString() })
        .eq("id", weekId)
        .is("published_at", null);
    return {
      runId: run.id,
      events: events.length,
      snapshots: snapshotsWritten,
      quotaRemaining: quota.remaining,
    };
  } catch (error) {
    await admin
      .from("odds_ingestion_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Unknown ingestion error",
      })
      .eq("id", run.id);
    throw error;
  }
}

function gameType(kickoff: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(kickoff));
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  if (weekday === "Wed" || weekday === "Fri" || weekday === "Sat")
    return "special";
  if (weekday === "Thu") return "tnf";
  if (weekday === "Mon") return "mnf";
  if (weekday === "Sun" && hour >= 19) return "snf";
  return "sunday";
}
