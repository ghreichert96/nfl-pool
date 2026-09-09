import { describe, expect, it } from "vitest";

import { consensusLine, consensusPoint } from "./consensus";

describe("consensusPoint", () => {
  it("selects the most commonly observed line", () => {
    expect(
      consensusPoint([
        { bookmaker: "a", point: -3.5 },
        { bookmaker: "b", point: -3.5 },
        { bookmaker: "c", point: -3 },
      ]),
    ).toBe(-3.5);
  });

  it("prefers an observed half point when the mode is tied", () => {
    expect(
      consensusPoint([
        { bookmaker: "a", point: -3 },
        { bookmaker: "b", point: -3.5 },
      ]),
    ).toBe(-3.5);
  });

  it("returns null without valid observations", () => {
    expect(consensusPoint([])).toBeNull();
  });
});

describe("consensusLine", () => {
  it("reports distinct sportsbook coverage", () => {
    expect(
      consensusLine({
        spreads: [
          { bookmaker: "a", point: 2.5 },
          { bookmaker: "b", point: 2.5 },
        ],
        totals: [{ bookmaker: "a", point: 44.5 }],
      }),
    ).toEqual({
      awaySpread: 2.5,
      total: 44.5,
      spreadBooks: 2,
      totalBooks: 1,
    });
  });
});
