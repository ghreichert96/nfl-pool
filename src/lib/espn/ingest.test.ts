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
