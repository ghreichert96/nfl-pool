import { describe, expect, it } from "vitest";
import { gridSlots, type PickCounts } from "./grid-slots";
import type { ScoringPick } from "./scoring";
const counts: PickCounts = {
  ats_count: 3,
  total_count: 1,
  has_best_bet: true,
  has_underdog: false,
  has_sudden_death: true,
};
const pick: ScoringPick = {
  entryId: 1,
  gameId: 1,
  kind: "ats",
  team: "BUF",
  totalDirection: null,
  isBestBet: false,
};
describe("grid occupancy", () => {
  it("marks only submitted slots before kickoff", () => {
    expect(gridSlots([], counts)).toEqual([
      "hidden",
      "hidden",
      "hidden",
      null,
      null,
      null,
      "hidden",
      null,
      null,
      null,
      "hidden",
    ]);
  });
  it("subtracts revealed picks from hidden occupancy within each category", () => {
    const slots = gridSlots([pick], counts);
    expect(slots[1]).toBe(pick);
    expect(slots.filter((s) => s === "hidden")).toHaveLength(4);
    expect(slots.filter((s) => s === null)).toHaveLength(6);
  });
  it("shows blanks for an empty revision, even if it was submitted", () => {
    expect(
      gridSlots([], {
        ...counts,
        ats_count: 0,
        total_count: 0,
        has_best_bet: false,
        has_sudden_death: false,
      }).every((s) => s === null),
    ).toBe(true);
  });
  it("keeps all six ATS picks visible if Best Bet was omitted", () => {
    const picks = Array.from({ length: 6 }, (_, i) => ({
      ...pick,
      gameId: i + 1,
    }));
    expect(gridSlots(picks).filter((s) => s && s !== "hidden")).toHaveLength(6);
  });
  it("does not invent hidden picks when counts are unavailable", () => {
    expect(gridSlots([pick]).filter((s) => s === "hidden")).toHaveLength(0);
  });
});
