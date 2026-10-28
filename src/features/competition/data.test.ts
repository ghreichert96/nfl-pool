import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loadCompetition } from "./data";

function seasonFixture() {
  const entries = Array.from({ length: 16 }, (_, i) => ({
    id: i + 1,
    season_id: 1,
    entry_code: `E${i}`,
    user_id: `u${i}`,
  }));
  const weeks = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    season_id: 1,
    week_number: i + 1,
    published_at: "2026-09-01",
    label: `Week ${i + 1}`,
  }));
  const games = weeks.flatMap((w) =>
    Array.from({ length: 9 }, (_, i) => ({
      id: w.id * 100 + i,
      week_id: w.id,
      away_team: "BUF",
      home_team: "MIA",
      kickoff_at: "2026-09-01",
      away_score: 30,
      home_score: 10,
      status: "final",
      pool_lines: { away_spread: 3, total: 35 },
    })),
  );
  const submissions = entries.flatMap((e) =>
    weeks.flatMap((w) =>
      Array.from({ length: 12 }, (_, i) => ({
        id: e.id * 10000 + w.id * 100 + i,
        entry_id: e.id,
        week_id: w.id,
        revision: i + 1,
        submitted_at: "2026-09-01",
      })),
    ),
  );
  const picks = submissions
    .filter((s) => s.revision === 12)
    .flatMap((s) => [
      ...Array.from({ length: 9 }, (_, i) => ({
        id: s.id * 100 + i,
        submission_id: s.id,
        game_id: s.week_id * 100 + i,
        kind: i < 6 ? "ats" : "total",
        team: i < 6 ? "BUF" : null,
        total_direction: i < 6 ? null : "over",
        is_best_bet: i === 0,
      })),
      ...["sudden_death", "underdog"].map((kind, i) => ({
        id: s.id * 100 + 9 + i,
        submission_id: s.id,
        game_id: s.week_id * 100,
        kind,
        team: "BUF",
        total_direction: null,
        is_best_bet: false,
      })),
    ]);
  return {
    pool_entries: entries,
    pool_weeks: weeks,
    games,
    weekly_submissions: submissions,
    picks,
    seasons: [{ id: 1, sd_pot: 200, ud_pot: 200 }],
  };
}

// Simulate the API's cap, filters, and ordered ranges for a full season load.
function clientFor(tables: Record<string, object[]>, failPicksPage = false) {
  return {
    from(table: string) {
      let rows = (tables[table] ?? []) as Record<string, unknown>[];
      const orders: { key: string; ascending: boolean }[] = [];
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          rows = rows.filter((r) => r[key] === value);
          return query;
        },
        lte: (key: string, value: number) => {
          rows = rows.filter((r) => Number(r[key]) <= value);
          return query;
        },
        not: (key: string) => {
          rows = rows.filter((r) => r[key] != null);
          return query;
        },
        in: (key: string, values: unknown[]) => {
          rows = rows.filter((r) => values.includes(r[key]));
          return query;
        },
        order: (key: string, options?: { ascending: boolean }) => {
          orders.push({ key, ascending: options?.ascending ?? true });
          return query;
        },
        single: async () => ({ data: rows[0], error: null }),
        range: async (from: number, to: number) => {
          if (table === "picks" && failPicksPage && from >= 500)
            return { data: null, error: new Error("Pick page failed") };
          const sorted = [...rows].sort((a, b) => {
            for (const { key, ascending } of orders) {
              const av = a[key] as number,
                bv = b[key] as number;
              if (av !== bv) return (av < bv ? -1 : 1) * (ascending ? 1 : -1);
            }
            return 0;
          });
          return {
            data: sorted.slice(from, Math.min(to + 1, from + 1000)),
            error: null,
          };
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

describe("loadCompetition season history", () => {
  it("scores all entries past 1,000 picks and 1,000 submission revisions", async () => {
    const data = await loadCompetition(clientFor(seasonFixture()), 1);
    expect(data.submissions).toHaveLength(1152);
    expect(data.latest.size).toBe(96);
    expect(data.picks).toHaveLength(1056);
    expect(data.standings).toHaveLength(16);
    for (const standing of data.standings)
      expect(standing).toMatchObject({
        wins: 60,
        losses: 0,
        ties: 0,
        suddenDeathStrikes: 0,
        eliminated: false,
        underdogPoints: 18,
      });
  });
  it("retains the selected week boundary", async () => {
    const data = await loadCompetition(clientFor(seasonFixture()), 1, 3);
    expect(data.picks).toHaveLength(528);
    expect(data.standings.every((s) => s.wins === 30)).toBe(true);
  });
  it("computes selected-week payouts without using later results", async () => {
    const fixture = seasonFixture();
    for (const pick of fixture.picks) {
      const submission = fixture.weekly_submissions.find(
        (s) => s.id === pick.submission_id,
      )!;
      if (
        submission.entry_id === 1 &&
        submission.week_id >= 4 &&
        pick.kind === "ats"
      )
        pick.team = "MIA";
    }
    const tables = {
      ...fixture,
      payout_schedules: [
        { season_id: 1, rank: 1, amount: 160, locked_at: null },
      ],
    };
    const early = await loadCompetition(clientFor(tables), 1, 3);
    const late = await loadCompetition(clientFor(tables), 1, 6);
    expect(early.financials.get(1)?.main).toBe(10);
    expect(late.financials.get(1)?.main).toBe(0);
  });
  it("does not publish partial standings when a pick page fails", async () => {
    await expect(
      loadCompetition(clientFor(seasonFixture(), true), 1),
    ).rejects.toThrow("Pick page failed");
  });
});
