import { describe, expect, it, vi } from "vitest";

import { fetchNflOdds, fetchNflScores } from "./provider";

describe("fetchNflOdds", () => {
  it("requests one US region and parses quota headers", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      expect(String(input)).toContain("regions=us");
      expect(String(input)).not.toContain("us2");
      expect(String(input)).toContain("markets=spreads%2Ctotals");
      expect(String(input)).toContain(
        "commenceTimeFrom=2026-09-10T00%3A00%3A00Z",
      );
      expect(String(input)).toContain(
        "commenceTimeTo=2026-09-15T00%3A00%3A00Z",
      );
      return new Response("[]", {
        status: 200,
        headers: { "x-requests-remaining": "97", "x-requests-used": "3" },
      });
    });
    const result = await fetchNflOdds(
      "secret",
      {
        from: "2026-09-10T00:00:00.000Z",
        to: "2026-09-15T00:00:00.000Z",
      },
      fetcher as typeof fetch,
    );
    expect(result.events).toEqual([]);
    expect(result.quota.remaining).toBe(97);
  });
  it("rejects malformed provider data", async () => {
    const fetcher = vi.fn(
      async () => new Response('[{"id":"bad"}]', { status: 200 }),
    );
    await expect(
      fetchNflOdds("secret", undefined, fetcher as typeof fetch),
    ).rejects.toThrow();
  });
});

describe("fetchNflScores", () => {
  it("requests live scores for specific events at one-credit cost", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      expect(url.pathname).toContain("americanfootball_nfl/scores");
      expect(url.searchParams.get("eventIds")).toBe("game-a,game-b");
      expect(url.searchParams.has("daysFrom")).toBe(false);
      return new Response("[]", {
        headers: {
          "x-requests-last": "1",
          "x-requests-remaining": "80",
        },
      });
    });
    const result = await fetchNflScores(
      "secret",
      { includeCompleted: false, eventIds: ["game-a", "game-b"] },
      fetcher as typeof fetch,
    );
    expect(result.quota).toMatchObject({ last: 1, remaining: 80 });
  });

  it("requests completed games only when reconciliation is required", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      expect(new URL(String(input)).searchParams.get("daysFrom")).toBe("1");
      return new Response(
        JSON.stringify([
          {
            id: "game-a",
            sport_key: "americanfootball_nfl",
            commence_time: "2026-09-10T00:20:00Z",
            completed: true,
            home_team: "Seattle Seahawks",
            away_team: "New England Patriots",
            scores: [
              { name: "New England Patriots", score: "17" },
              { name: "Seattle Seahawks", score: "20" },
            ],
            last_update: "2026-09-10T04:00:00Z",
          },
        ]),
        { headers: { "x-requests-last": "2" } },
      );
    });
    const result = await fetchNflScores(
      "secret",
      { includeCompleted: true },
      fetcher as typeof fetch,
    );
    expect(result.events[0].completed).toBe(true);
    expect(result.events[0].scores?.[0].score).toBe("17");
  });

  it("isolates malformed score events", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            { id: "bad" },
            {
              id: "good",
              sport_key: "americanfootball_nfl",
              commence_time: "2026-09-10T00:20:00Z",
              completed: false,
              home_team: "Seattle Seahawks",
              away_team: "New England Patriots",
              scores: null,
              last_update: null,
            },
          ]),
        ),
    );
    const result = await fetchNflScores(
      "secret",
      { includeCompleted: false },
      fetcher as typeof fetch,
    );
    expect(result.events).toHaveLength(1);
    expect(result.invalidEvents).toBe(1);
  });
});
