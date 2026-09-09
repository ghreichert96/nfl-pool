import { describe, expect, it } from "vitest";

import { deriveGameResult } from "./result";

describe("deriveGameResult", () => {
  const game = { away: "CLE", home: "PIT", awaySpread: 3.5, total: 41.5 };

  it("derives ATS, total, and outright winners from frozen lines", () => {
    expect(deriveGameResult(game, 20, 21)).toEqual({
      atsWinner: "CLE",
      totalWinner: "under",
      outrightWinner: "PIT",
    });
  });

  it("preserves pushes and NFL ties", () => {
    expect(
      deriveGameResult({ ...game, awaySpread: 0, total: 40 }, 20, 20),
    ).toEqual({
      atsWinner: null,
      totalWinner: null,
      outrightWinner: null,
    });
  });
});
