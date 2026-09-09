import { describe, expect, it } from "vitest";

import {
  SCORE_QUOTA_RESERVE,
  scoresForEvent,
  shouldProtectReserve,
} from "./ingest";

describe("score ingestion policy", () => {
  it("protects the last 49 credits from live-only requests", () => {
    expect(SCORE_QUOTA_RESERVE).toBe(49);
    expect(shouldProtectReserve(50, false)).toBe(false);
    expect(shouldProtectReserve(49, false)).toBe(true);
    expect(shouldProtectReserve(0, false)).toBe(true);
  });

  it("allows essential completed-result requests inside the reserve", () => {
    expect(shouldProtectReserve(49, true)).toBe(false);
    expect(shouldProtectReserve(1, true)).toBe(false);
  });

  it("maps scores using provider team names rather than response order", () => {
    expect(
      scoresForEvent({
        id: "event",
        sport_key: "americanfootball_nfl",
        commence_time: "2026-09-10T00:20:00Z",
        completed: false,
        home_team: "Seattle Seahawks",
        away_team: "New England Patriots",
        scores: [
          { name: "Seattle Seahawks", score: "20" },
          { name: "New England Patriots", score: "17" },
        ],
        last_update: "2026-09-10T03:30:00Z",
      }),
    ).toEqual({ awayScore: 17, homeScore: 20 });
  });
});
