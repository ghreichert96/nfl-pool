import { describe, expect, it } from "vitest";

import type { EspnLiveEvent } from "./provider";
import { matchEspnEvent } from "./ingest";

const event: EspnLiveEvent = {
  id: "espn-1",
  kickoffAt: "2026-09-10T00:20:00.000Z",
  awayTeam: "NE",
  homeTeam: "SEA",
  awayScore: 7,
  homeScore: 10,
  period: 2,
  clock: "6:54",
  state: "live",
  detail: "Q2 · 6:54",
};

describe("ESPN game matching", () => {
  const game = {
    espn_event_id: null,
    away_team: "NE",
    home_team: "SEA",
    kickoff_at: "2026-09-10T00:20:00.000Z",
  };

  it("matches a unique event by teams and kickoff", () => {
    expect(matchEspnEvent(game, [event])).toEqual(event);
  });

  it("rejects ambiguous matches", () => {
    expect(
      matchEspnEvent(game, [event, { ...event, id: "espn-2" }]),
    ).toBeNull();
  });

  it("prefers a persisted ESPN event ID", () => {
    expect(
      matchEspnEvent({ ...game, espn_event_id: "espn-2" }, [
        event,
        { ...event, id: "espn-2" },
      ])?.id,
    ).toBe("espn-2");
  });
});

import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestEspnLiveStatus } from "./ingest";
import { fetchEspnNflScoreboard } from "./provider";
import { saveFinalGameResult } from "@/lib/scores/result";
vi.mock("./provider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./provider")>()),
  fetchEspnNflScoreboard: vi.fn(),
}));
vi.mock("@/lib/scores/result", () => ({ saveFinalGameResult: vi.fn() }));
function mockAdmin(games: unknown[]) {
  const updates: unknown[] = [];
  const from = vi.fn((table: string) => {
    let operation = "select";
    const query = {
      select: () => query,
      in: () => query,
      or: () => query,
      gte: () => query,
      lte: () => query,
      order: () => query,
      eq: () => query,
      single: () => query,
      insert: () => {
        operation = "insert";
        return query;
      },
      update: (value: unknown) => {
        operation = "update";
        updates.push(value);
        return query;
      },
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve(
          resolve({
            data:
              operation === "select" && table === "games"
                ? games
                : operation === "insert"
                  ? { id: 1 }
                  : null,
            error: null,
          }),
        ),
    };
    return query;
  });
  return { admin: { from } as unknown as SupabaseClient, updates };
}
describe("ESPN finalization", () => {
  it("does not request provider data when there are no active games or only commissioner overrides", async () => {
    vi.mocked(fetchEspnNflScoreboard).mockClear();
    for (const games of [[], [{ game_results: { source: "commissioner" } }]]) {
      const { admin } = mockAdmin(games);
      expect((await ingestEspnLiveStatus({ admin })).status).toBe("skipped");
    }
    expect(fetchEspnNflScoreboard).not.toHaveBeenCalled();
  });
  it("finalizes ESPN finals through the shared atomic result pipeline", async () => {
    vi.mocked(saveFinalGameResult).mockResolvedValue(3);
    vi.mocked(fetchEspnNflScoreboard).mockResolvedValue([
      { ...event, state: "final" },
    ]);
    const { admin } = mockAdmin([
      {
        id: 1,
        week_id: 1,
        espn_event_id: event.id,
        away_team: "NE",
        home_team: "SEA",
        kickoff_at: event.kickoffAt,
        game_results: null,
        pool_lines: { away_spread: 3, total: 40 },
        game_type_override: false,
      },
    ]);
    const result = await ingestEspnLiveStatus({
      admin,
      now: new Date("2026-09-10T05:00:00Z"),
    });
    expect(result.status).toBe("succeeded");
    expect(saveFinalGameResult).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "provider",
        game: expect.objectContaining({
          awayScore: 7,
          homeScore: 10,
          status: "final",
        }),
      }),
    );
  });
  it("records finalization failures for retry rather than reporting success", async () => {
    vi.mocked(saveFinalGameResult).mockRejectedValue(
      new Error("transaction rolled back"),
    );
    vi.mocked(fetchEspnNflScoreboard).mockResolvedValue([
      { ...event, state: "final" },
    ]);
    const { admin, updates } = mockAdmin([
      {
        id: 1,
        week_id: 1,
        espn_event_id: event.id,
        away_team: "NE",
        home_team: "SEA",
        kickoff_at: event.kickoffAt,
        game_results: null,
        pool_lines: { away_spread: 3, total: 40 },
      },
    ]);
    const result = await ingestEspnLiveStatus({
      admin,
      now: new Date("2026-09-10T05:00:00Z"),
    });
    expect(result.status).toBe("partial");
    expect(updates).toContainEqual(
      expect.objectContaining({ error_message: "1: transaction rolled back" }),
    );
  });
});
