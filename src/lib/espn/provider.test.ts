import { describe, expect, it, vi } from "vitest";

import {
  fetchEspnNflScoreboard,
  liveDetail,
  normalizeEspnTeam,
} from "./provider";

describe("ESPN live provider", () => {
  it("normalizes Washington and formats live states", () => {
    expect(normalizeEspnTeam("wsh")).toBe("WAS");
    expect(liveDetail("live", 2, "6:54")).toBe("Q2 · 6:54");
    expect(liveDetail("halftime", 2, "0:00")).toBe("Halftime");
    expect(liveDetail("live", 5, "4:12")).toBe("OT · 4:12");
    expect(liveDetail("final", 4, "0:00")).toBe("Final · Verifying");
  });

  it("parses teams, scores, clock, and a provisional final", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            events: [
              {
                id: "401772510",
                date: "2026-09-10T00:20Z",
                competitions: [
                  {
                    competitors: [
                      {
                        homeAway: "home",
                        score: "20",
                        team: { abbreviation: "SEA" },
                      },
                      {
                        homeAway: "away",
                        score: "17",
                        team: { abbreviation: "NE" },
                      },
                    ],
                    status: {
                      displayClock: "0:00",
                      period: 4,
                      type: {
                        state: "post",
                        completed: true,
                        description: "Final",
                        detail: "Final",
                        shortDetail: "Final",
                      },
                    },
                  },
                ],
              },
            ],
          }),
        ),
    );
    await expect(
      fetchEspnNflScoreboard(fetcher as typeof fetch),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "401772510",
        kickoffAt: "2026-09-10T00:20:00.000Z",
        awayTeam: "NE",
        homeTeam: "SEA",
        awayScore: 17,
        homeScore: 20,
        state: "final",
        detail: "Final · Verifying",
      }),
    ]);
  });
});
