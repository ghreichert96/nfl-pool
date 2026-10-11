import type { SupabaseClient } from "@supabase/supabase-js";

import { preferredLine } from "./consensus";
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

export function ingestionError(error: unknown) {
  return error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : String(error);
}

export async function ingestOdds({
  admin,
  apiKey,
  weekId,
  requestedBy = null,
  triggerSource,
  finalize = false,
}: {
  admin: SupabaseClient;
  apiKey: string;
  weekId: number;
  requestedBy?: string | null;
  triggerSource: "scheduled" | "commissioner";
  finalize?: boolean;
}) {
  const lease = crypto.randomUUID();
  const claimed = await admin.rpc("claim_odds_lease", {
    target_week_id: weekId,
    lease_token: lease,
  });
  if (claimed.error) throw claimed.error;
  if (!claimed.data)
    throw new Error("An odds refresh is already running for this week");
  let runId: number | undefined;
  let received = 0,
    snapshotsWritten = 0,
    quotaRemaining: number | null = null,
    quotaUsed: number | null = null;
  let counts = { applied: 0, unchanged: 0, skipped: 0 };
  const failures: string[] = [];
  const observations: Record<string, unknown>[] = [];
  try {
    const run = await admin
      .from("odds_ingestion_runs")
      .insert({
        week_id: weekId,
        requested_by: requestedBy,
        trigger_source: triggerSource,
        status: "running",
      })
      .select("id")
      .single();
    if (run.error || !run.data)
      throw run.error ?? new Error("Could not start run");
    runId = run.data.id;
    const week = await admin
      .from("pool_weeks")
      .select("lines_frozen_at,lines_freeze_at")
      .eq("id", weekId)
      .single();
    if (week.error) throw week.error;
    const freezeAt = Date.parse(week.data.lines_freeze_at);
    try {
      if (!apiKey)
        throw new Error("ODDS_API_KEY is missing; last saved lines retained");
      const response = await fetchNflOdds(apiKey, {
        from: new Date(
          Math.max(Date.now(), freezeAt - 3 * 86400000),
        ).toISOString(),
        to: new Date(freezeAt + 5 * 86400000).toISOString(),
      });
      received = response.events.length;
      quotaRemaining = response.quota.remaining;
      quotaUsed = response.quota.used;
      if (!received)
        failures.push(
          "Provider returned no upcoming games; last saved lines retained",
        );
      for (const event of response.events) {
        try {
          const away = teamCodes[event.away_team],
            home = teamCodes[event.home_team];
          if (!away || !home) {
            counts.skipped++;
            continue;
          }
          const existing = await admin
            .from("games")
            .select("id,week_id,game_type_override")
            .eq("provider_event_id", event.id)
            .maybeSingle();
          if (existing.error) throw existing.error;
          if (existing.data && existing.data.week_id !== weekId) {
            counts.skipped++;
            continue;
          }
          const values = {
            kickoff_at: event.commence_time,
            ...(!existing.data?.game_type_override
              ? { game_type: gameType(event.commence_time) }
              : {}),
          };
          const game = existing.data
            ? await admin
                .from("games")
                .update(values)
                .eq("id", existing.data.id)
                .select("id")
                .single()
            : await admin
                .from("games")
                .insert({
                  ...values,
                  week_id: weekId,
                  provider_event_id: event.id,
                  away_team: away,
                  home_team: home,
                  status: "scheduled",
                })
                .select("id")
                .single();
          if (game.error || !game.data)
            throw game.error ?? new Error("Game write returned no row");
          const snapshots = event.bookmakers.flatMap((book) =>
            book.markets.flatMap((market) =>
              market.outcomes
                .filter(
                  (outcome) =>
                    typeof outcome.point === "number" &&
                    Number.isFinite(outcome.point),
                )
                .map((outcome) => ({
                  run_id: runId,
                  game_id: game.data.id,
                  provider_event_id: event.id,
                  bookmaker_key: book.key,
                  bookmaker_name: book.title,
                  market: market.key,
                  outcome_name: outcome.name,
                  point: outcome.point,
                  price: outcome.price ?? null,
                  provider_updated_at:
                    market.last_update ?? book.last_update ?? null,
                })),
            ),
          );
          if (snapshots.length) {
            const saved = await admin.from("odds_snapshots").insert(snapshots);
            if (saved.error) throw saved.error;
            snapshotsWritten += snapshots.length;
          }
          const prior = await admin
            .from("pool_lines")
            .select("spread_observed_at,total_observed_at")
            .eq("game_id", game.data.id)
            .maybeSingle();
          if (prior.error) throw prior.error;
          const points = (market: string, name: string) =>
            event.bookmakers.flatMap((book) =>
              book.markets
                .filter((m) => m.key === market)
                .flatMap((m) =>
                  m.outcomes
                    .filter(
                      (o) =>
                        o.name.toLowerCase() === name.toLowerCase() &&
                        typeof o.point === "number" &&
                        Number.isFinite(o.point) &&
                        (market === "totals"
                          ? o.point > 0 && o.point <= 999
                          : Math.abs(o.point) <= 99),
                    )
                    .map((o) => ({
                      bookmaker: book.key,
                      point: o.point!,
                      observedAt: m.last_update ?? book.last_update ?? null,
                    })),
                ),
            );
          const spread = preferredLine(
            points("spreads", event.away_team),
            prior.data?.spread_observed_at,
          );
          const total = preferredLine(
            points("totals", "over"),
            prior.data?.total_observed_at,
          );
          if (!spread || !total)
            failures.push(
              `${away} @ ${home}: missing or stale ${!spread ? "spread" : "total"}; last saved value retained`,
            );
          observations.push({
            game_id: game.data.id,
            warning:
              !spread || !total
                ? "Missing or stale provider observation; last saved value retained."
                : null,
            away_spread: spread?.point ?? null,
            total: total?.point ?? null,
            spread_book: spread?.bookmaker,
            total_book: total?.bookmaker,
            spread_observed_at: spread?.observedAt,
            total_observed_at: total?.observedAt,
            spread_fallback: spread?.fallback,
            total_fallback: total?.fallback,
          });
        } catch (error) {
          failures.push(`${event.id}: ${ingestionError(error)}`);
        }
      }
    } catch (error) {
      failures.push(ingestionError(error));
    }
    // Even a failed final fetch must lock the last saved lines at the deadline.
    const applied = await admin.rpc("apply_odds_lines", {
      target_week_id: weekId,
      observations,
      final_pull: finalize,
    });
    if (applied.error) throw applied.error;
    counts = {
      ...counts,
      applied: applied.data.applied,
      unchanged: applied.data.unchanged,
      skipped: counts.skipped + applied.data.skipped,
    };
    if (counts.applied) {
      const published = await admin
        .from("pool_weeks")
        .update({ published_at: new Date().toISOString() })
        .eq("id", weekId)
        .is("published_at", null);
      if (published.error) throw published.error;
    }
    const status = failures.length
      ? counts.applied || counts.unchanged || finalize
        ? "partial"
        : "failed"
      : "succeeded";
    const finished = await admin
      .from("odds_ingestion_runs")
      .update({
        status,
        completed_at: new Date().toISOString(),
        events_received: received,
        snapshots_written: snapshotsWritten,
        quota_remaining: quotaRemaining,
        quota_used: quotaUsed,
        ...counts,
        failed: failures.length,
        error_message: failures.join("; ").slice(0, 2000) || null,
      })
      .eq("id", runId);
    if (finished.error) throw finished.error;
    return {
      status,
      runId,
      events: received,
      snapshots: snapshotsWritten,
      lines: counts.applied,
      quotaRemaining,
      failures,
      ...counts,
    };
  } catch (error) {
    if (runId)
      await admin
        .from("odds_ingestion_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: ingestionError(error).slice(0, 2000),
          failed: failures.length + 1,
        })
        .eq("id", runId);
    throw error;
  } finally {
    await admin.rpc("release_odds_lease", {
      target_week_id: weekId,
      lease_token: lease,
    });
  }
}

export function gameType(kickoff: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(kickoff));
  const day = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  if (day === "Sun" && hour < 12) return "international";
  if (day === "Thu") return "tnf";
  if (day === "Mon") return "mnf";
  if (day === "Sun" && hour >= 19) return "snf";
  return day === "Sun" ? "sunday" : "special";
}
