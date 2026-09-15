import { describe, expect, it } from "vitest";

import { easternLocalToIso, nextWeeklyFreeze } from "./eastern-time";

describe("Eastern pool scheduling", () => {
  it("converts Eastern local times to instants", () => {
    expect(easternLocalToIso("2026-09-10T20:00")).toBe(
      "2026-09-11T00:00:00.000Z",
    );
  });

  it("keeps the next freeze at 8 PM Eastern across DST", () => {
    expect(nextWeeklyFreeze("2026-10-30T00:00:00.000Z")).toBe(
      "2026-11-06T01:00:00.000Z",
    );
  });
});
