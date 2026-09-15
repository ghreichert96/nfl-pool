import { describe, expect, it } from "vitest";

import { selectPoolWeek, weekRolloverAt } from "./pool-weeks";

const weeks = [
  {
    id: 1,
    week_number: 1,
    lines_freeze_at: "2026-09-11T00:00:00.000Z",
  },
  {
    id: 2,
    week_number: 2,
    lines_freeze_at: "2026-09-18T00:00:00.000Z",
  },
];

describe("pool week selection", () => {
  it("rolls a normal week at Tuesday 2 AM Eastern", () => {
    expect(weekRolloverAt(weeks[1]).toISOString()).toBe(
      "2026-09-15T06:00:00.000Z",
    );
    expect(
      selectPoolWeek(weeks, Number.NaN, new Date("2026-09-15T05:59:59Z"))
        ?.week_number,
    ).toBe(1);
    expect(
      selectPoolWeek(weeks, Number.NaN, new Date("2026-09-15T06:00:00Z"))
        ?.week_number,
    ).toBe(2);
  });

  it("allows an explicitly selected published future or historical week", () => {
    expect(
      selectPoolWeek(weeks, 2, new Date("2026-09-13T16:00:00Z"))?.week_number,
    ).toBe(2);
    expect(
      selectPoolWeek(weeks, 1, new Date("2026-09-20T16:00:00Z"))?.week_number,
    ).toBe(1);
  });

  it("falls back to the first published week before opening rollover", () => {
    expect(
      selectPoolWeek(weeks, Number.NaN, new Date("2026-09-01T12:00:00Z"))
        ?.week_number,
    ).toBe(1);
  });
});
