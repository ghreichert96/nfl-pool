import { describe, expect, it } from "vitest";

import {
  SCORE_QUOTA_RESERVE,
  scoresForEvent,
  shouldHoldForSlate,
  shouldProtectReserve,
  validationRetry,
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

  it("holds a final while another game in its kickoff slate remains live", () => {
    const finalGame = {
      id: 1,
      week_id: 1,
      kickoff_at: "2026-09-13T17:00:00.000Z",
      final_detected_at: "2026-09-13T20:05:00.000Z",
    };
    const active = [
      {
        id: 2,
        week_id: 1,
        kickoff_at: "2026-09-13T17:05:00.000Z",
        live_state: "live",
      },
    ];
    expect(
      shouldHoldForSlate(finalGame, active, new Date("2026-09-13T20:20:00Z")),
    ).toBe(true);
    expect(
      shouldHoldForSlate(finalGame, active, new Date("2026-09-13T20:50:00Z")),
    ).toBe(false);
  });

  it("does not hold an isolated final for a different kickoff slate", () => {
    expect(
      shouldHoldForSlate(
        {
          id: 1,
          week_id: 1,
          kickoff_at: "2026-09-13T17:00:00.000Z",
          final_detected_at: "2026-09-13T20:05:00.000Z",
        },
        [
          {
            id: 2,
            week_id: 1,
            kickoff_at: "2026-09-13T20:25:00.000Z",
            live_state: "live",
          },
        ],
        new Date("2026-09-13T20:20:00Z"),
      ),
    ).toBe(false);
  });

  it("backs off unavailable finals before reconciliation", () => {
    const now = new Date("2026-09-13T21:00:00.000Z");
    expect(validationRetry(0, now)).toEqual({
      attempts: 1,
      state: "retry",
      nextAt: "2026-09-13T21:30:00.000Z",
    });
    expect(validationRetry(1, now)).toEqual({
      attempts: 2,
      state: "retry",
      nextAt: "2026-09-13T23:00:00.000Z",
    });
    expect(validationRetry(2, now)).toEqual({
      attempts: 3,
      state: "reconciliation",
      nextAt: null,
    });
  });
});
