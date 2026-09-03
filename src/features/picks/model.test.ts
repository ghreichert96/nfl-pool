import { describe, expect, it } from "vitest";

import { EMPTY_PICKS, toggleTeamPick, validationMessage } from "./model";

describe("pick model", () => {
  it("replaces an ATS side without consuming another slot", () => {
    const first = toggleTeamPick([], { gameId: "a", team: "BUF" }, 6);
    const replaced = toggleTeamPick(first, { gameId: "a", team: "MIA" }, 6);

    expect(replaced).toEqual([{ gameId: "a", team: "MIA" }]);
  });

  it("describes incomplete prototype picks", () => {
    expect(validationMessage(EMPTY_PICKS)).toContain("6 ATS");
  });
});
