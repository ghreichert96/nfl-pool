import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestOdds } from "./ingest";
import { fetchNflOdds } from "./provider";
vi.mock("./provider", () => ({ fetchNflOdds: vi.fn() }));
const event = {
  id: "event-1",
  sport_key: "americanfootball_nfl",
  commence_time: "2026-10-18T17:00:00Z",
  away_team: "Buffalo Bills",
  home_team: "Miami Dolphins",
  bookmakers: [
    {
      key: "draftkings",
      title: "DraftKings",
      last_update: "2026-10-14T20:00:00Z",
      markets: [
        {
          key: "spreads" as const,
          outcomes: [{ name: "Buffalo Bills", point: -3 }],
        },
        { key: "totals" as const, outcomes: [{ name: "Over", point: 44 }] },
      ],
    },
  ],
};
function database(fail?: string) {
  const writes: { table: string; operation: string; values: unknown }[] = [];
  const rpc = vi.fn(async (name: string) => ({
    data:
      name === "claim_odds_lease"
        ? true
        : name === "apply_odds_lines"
          ? { applied: 1, unchanged: 0, skipped: 0 }
          : null,
    error:
      name === "apply_odds_lines" && fail === "lines"
        ? { message: "line write rejected" }
        : null,
  }));
  const from = vi.fn((table: string) => {
    let operation = "select";
    let values: unknown;
    const query = {
      select: () => query,
      eq: () => query,
      is: () => query,
      single: () => query,
      maybeSingle: () => query,
      insert: (value: unknown) => {
        operation = "insert";
        values = value;
        return query;
      },
      update: (value: unknown) => {
        operation = "update";
        values = value;
        return query;
      },
      then: (resolve: (result: unknown) => unknown) => {
        if (operation !== "select") writes.push({ table, operation, values });
        const error =
          fail === table && operation !== "select"
            ? { message: `${table} write rejected` }
            : null;
        const data =
          table === "games"
            ? { id: 77, week_id: 1, game_type_override: false }
            : table === "pool_weeks"
              ? {
                  lines_frozen_at: null,
                  lines_freeze_at: "2026-10-16T00:00:00Z",
                }
              : table === "odds_ingestion_runs"
                ? { id: 1 }
                : table === "pool_lines"
                  ? { spread_observed_at: null, total_observed_at: null }
                  : null;
        return Promise.resolve(resolve({ data, error }));
      },
    };
    return query;
  });
  return { admin: { from, rpc } as unknown as SupabaseClient, writes, rpc };
}
afterEach(() => vi.resetAllMocks());
describe("odds ingestion failure paths", () => {
  it("updates existing games without supplying their generated ID or resetting status", async () => {
    vi.mocked(fetchNflOdds).mockResolvedValue({
      events: [event],
      quota: { remaining: 50, used: 5, last: 2 },
    });
    const db = database();
    const result = await ingestOdds({
      admin: db.admin,
      apiKey: "test",
      weekId: 1,
      triggerSource: "scheduled",
    });
    const write = db.writes.find((w) => w.table === "games")!;
    expect(write.operation).toBe("update");
    expect(write.values).not.toHaveProperty("id");
    expect(write.values).not.toHaveProperty("status");
    expect(result.snapshots).toBe(2);
    expect(result.status).toBe("succeeded");
  });
  it.each(["games", "odds_snapshots"])(
    "reports %s write failures instead of zero-snapshot success",
    async (table) => {
      vi.mocked(fetchNflOdds).mockResolvedValue({
        events: [event],
        quota: { remaining: 50, used: 5, last: 2 },
      });
      const db = database(table);
      const result = await ingestOdds({
        admin: db.admin,
        apiKey: "test",
        weekId: 1,
        triggerSource: "scheduled",
      });
      expect(result.status).not.toBe("succeeded");
      expect(result.snapshots).toBe(0);
      expect(result.failures[0]).toContain("write rejected");
    },
  );
  it("surfaces line-write errors and releases the lease", async () => {
    vi.mocked(fetchNflOdds).mockResolvedValue({
      events: [event],
      quota: { remaining: 50, used: 5, last: 2 },
    });
    const db = database("lines");
    await expect(
      ingestOdds({
        admin: db.admin,
        apiKey: "test",
        weekId: 1,
        triggerSource: "scheduled",
      }),
    ).rejects.toMatchObject({ message: "line write rejected" });
    expect(db.rpc).toHaveBeenCalledWith(
      "release_odds_lease",
      expect.anything(),
    );
  });
  it("locks last saved lines after a failed Thursday provider fetch", async () => {
    vi.mocked(fetchNflOdds).mockRejectedValue(
      new Error("provider unavailable"),
    );
    const db = database();
    const result = await ingestOdds({
      admin: db.admin,
      apiKey: "test",
      weekId: 1,
      triggerSource: "scheduled",
      finalize: true,
    });
    expect(db.rpc).toHaveBeenCalledWith("apply_odds_lines", {
      target_week_id: 1,
      observations: [],
      final_pull: true,
    });
    expect(result.failures).toEqual(["provider unavailable"]);
  });
});
