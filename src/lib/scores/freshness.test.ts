import { describe, expect, it } from "vitest";
import { scoreFreshness } from "./freshness";
const now = Date.parse("2026-10-11T20:00:00Z");
const game = {
  status: "live",
  kickoff_at: "2026-10-11T17:00:00Z",
  live_status_updated_at: "2026-10-11T19:59:00Z",
};
describe("score update indicator", () => {
  it("warns only when an active game reaches two hours without an update", () => {
    expect(
      scoreFreshness(
        [{ ...game, live_status_updated_at: "2026-10-11T18:01:00Z" }],
        now,
      )?.stale,
    ).toBe(false);
    expect(
      scoreFreshness(
        [{ ...game, live_status_updated_at: "2026-10-11T18:00:00Z" }],
        now,
      )?.stale,
    ).toBe(true);
  });
  it("does not let a healthy game conceal another stalled feed", () => {
    expect(
      scoreFreshness(
        [game, { ...game, live_status_updated_at: "2026-10-11T17:30:00Z" }],
        now,
      ),
    ).toEqual({ label: "2h", stale: true });
  });
  it("detects games never picked up while allowing two hours after kickoff", () => {
    expect(
      scoreFreshness(
        [{ ...game, status: "scheduled", live_status_updated_at: null }],
        now,
      ),
    ).toEqual({ label: "Pending", stale: true });
    expect(
      scoreFreshness(
        [
          {
            ...game,
            status: "scheduled",
            kickoff_at: "2026-10-11T19:00:00Z",
            live_status_updated_at: null,
          },
        ],
        now,
      )?.stale,
    ).toBe(false);
  });
  it("does not flag final, future, postponed, or cancelled games", () => {
    expect(
      scoreFreshness(
        ["final", "postponed", "cancelled"].map((status) => ({
          ...game,
          status,
          live_status_updated_at: null,
        })),
        now,
      ),
    ).toBeUndefined();
    expect(
      scoreFreshness(
        [{ ...game, status: "scheduled", kickoff_at: "2026-10-12T00:00:00Z" }],
        now,
      ),
    ).toBeUndefined();
  });
});
