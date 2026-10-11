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

import { preferredLine } from "./consensus";
describe("preferred bookmaker selection", () => {
  const at = "2026-10-08T20:00:00Z";
  it("uses DraftKings, then BetMGM, then FanDuel, then consensus independently", () => {
    const books = [
      { bookmaker: "draftkings", point: -3, observedAt: at },
      { bookmaker: "betmgm", point: -4, observedAt: at },
      { bookmaker: "fanduel", point: -5, observedAt: at },
      { bookmaker: "a", point: -6, observedAt: at },
    ];
    expect(
      books.map((_, i) => preferredLine(books.slice(i))?.bookmaker),
    ).toEqual(["draftkings", "betmgm", "fanduel", "consensus"]);
  });
  it("rejects stale and malformed observations and preserves a missing field", () => {
    expect(
      preferredLine([
        { bookmaker: "draftkings", point: NaN },
        { bookmaker: "betmgm", point: 3, observedAt: "bad" },
      ]),
    ).toBeNull();
    expect(
      preferredLine(
        [
          {
            bookmaker: "draftkings",
            point: 3,
            observedAt: "2026-10-07T20:00:00Z",
          },
        ],
        at,
      ),
    ).toBeNull();
    expect(preferredLine([], at)).toBeNull();
    expect(
      preferredLine([{ bookmaker: "draftkings", point: 3, observedAt: at }], at)
        ?.point,
    ).toBe(3);
  });
  it("deduplicates consensus books using their latest observation", () => {
    expect(
      preferredLine([
        { bookmaker: "a", point: 2, observedAt: at },
        { bookmaker: "a", point: 9, observedAt: "2026-10-07T20:00:00Z" },
        { bookmaker: "b", point: 2, observedAt: at },
      ])?.point,
    ).toBe(2);
  });
});
