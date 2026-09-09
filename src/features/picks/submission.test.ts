import { describe, expect, it } from "vitest";

import { MOCK_GAMES } from "./mock-games";
import type { Picks } from "./model";
import { preserveLockedPicks, toSubmissionPicks } from "./submission";

const saved: Picks = {
  ats: [{ gameId: "sf-lar", team: "SF" }],
  totals: [{ gameId: "sf-lar", direction: "under" }],
  bestBet: { gameId: "sf-lar", team: "SF" },
  suddenDeath: null,
  underdog: null,
};

describe("submission helpers", () => {
  it("serializes a Best Bet as an attribute of its ATS pick", () => {
    expect(toSubmissionPicks(saved)).toContainEqual({
      gameId: "sf-lar",
      kind: "ats",
      team: "SF",
      totalDirection: null,
      isBestBet: true,
    });
  });

  it("restores submitted selections when their game locks", () => {
    const games = MOCK_GAMES.map((game) =>
      game.id === "sf-lar" ? { ...game, status: "live" as const } : game,
    );
    const emptyDraft: Picks = {
      ats: [],
      totals: [],
      bestBet: null,
      suddenDeath: null,
      underdog: null,
    };

    expect(preserveLockedPicks(emptyDraft, saved, games)).toEqual(saved);
  });
});
