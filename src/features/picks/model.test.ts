import { describe, expect, it } from "vitest";

import {
  deriveGameResult,
  EMPTY_PICKS,
  toggleTeamPick,
  validationMessage,
} from "./model";

describe("pick model", () => {
  it("replaces an ATS side without consuming another slot", () => {
    const first = toggleTeamPick([], { gameId: "a", team: "BUF" }, 6);
    const replaced = toggleTeamPick(first, { gameId: "a", team: "MIA" }, 6);

    expect(replaced).toEqual([{ gameId: "a", team: "MIA" }]);
  });

  it("describes incomplete prototype picks", () => {
    expect(validationMessage(EMPTY_PICKS)).toContain("6 ATS");
  });

  it("derives frozen-line results for completed-game feedback", () => {
    expect(
      deriveGameResult({
        away: { abbreviation: "NE", name: "Patriots" },
        home: { abbreviation: "SEA", name: "Seahawks" },
        awaySpread: 3,
        total: 37,
        score: { away: 17, home: 20, detail: "Final" },
      }),
    ).toEqual({ atsWinner: null, totalWinner: null, winner: "SEA" });
  });
});
