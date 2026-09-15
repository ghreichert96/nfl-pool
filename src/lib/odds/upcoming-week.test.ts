import { describe, expect, it } from "vitest";

import { upcomingWeekNumber } from "./upcoming-week";

const week = (weekNumber: number, freeze: string) => ({
  id: weekNumber,
  season_id: 1,
  week_number: weekNumber,
  lines_freeze_at: freeze,
});

describe("upcoming week initialization", () => {
  it("targets the week after the most recent freeze", () => {
    expect(
      upcomingWeekNumber(
        [week(2, "2026-09-18T00:00:00Z"), week(1, "2026-09-11T00:00:00Z")],
        new Date("2026-09-13T16:00:00Z"),
      ),
    ).toBe(2);
  });

  it("returns the opening week before the first freeze", () => {
    expect(
      upcomingWeekNumber(
        [week(1, "2026-09-11T00:00:00Z")],
        new Date("2026-09-01T16:00:00Z"),
      ),
    ).toBe(1);
  });

  it("does not initialize Week 19", () => {
    expect(
      upcomingWeekNumber(
        [week(18, "2027-01-08T01:00:00Z")],
        new Date("2027-01-10T17:00:00Z"),
      ),
    ).toBeNull();
  });
});
