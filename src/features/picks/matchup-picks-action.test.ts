import { beforeEach, expect, it, vi } from "vitest";

import { getPoolContext } from "@/lib/pool-context";
import { loadMatchupPicks } from "./matchup-picks-action";

vi.mock("@/lib/pool-context");

const game = {
  week_id: 12,
  kickoff_at: "2020-11-26T01:00:00Z",
  status: "final",
  away_team: "GB",
  home_team: "LAR",
  pool_lines: { away_spread: -3.5, total: 45.5 },
};
const gameLookup = vi.fn();
const rows = vi.fn();
const from = vi.fn();
const eq = vi.fn();
const submission = (entry_id: number, entry_code: string, picks: object[]) => ({
  entry_id,
  pool_entries: { entry_code },
  picks,
});

beforeEach(() => {
  vi.clearAllMocks();
  gameLookup.mockResolvedValue({ data: game, error: null });
  const gameQuery = {
    select: () => gameQuery,
    eq: (...args: unknown[]) => {
      eq(...args);
      return gameQuery;
    },
    not: () => gameQuery,
    maybeSingle: gameLookup,
  };
  const submissionQuery = {
    select: () => submissionQuery,
    eq: (...args: unknown[]) => {
      eq(...args);
      return submissionQuery;
    },
    order: () => submissionQuery,
    range: rows,
  };
  from.mockImplementation((table: string) =>
    table === "games"
      ? gameQuery
      : table === "weekly_submissions"
        ? submissionQuery
        : {
            select: () => ({
              in: () => Promise.resolve({ data: [], error: null }),
            }),
          },
  );
  vi.mocked(getPoolContext).mockResolvedValue({
    supabase: { from },
    entry: { season_id: 42 },
  } as unknown as Awaited<ReturnType<typeof getPoolContext>>);
});

it("groups the latest matchup picks and combines an entry’s marks on each side", async () => {
  rows.mockResolvedValue({
    data: [
      submission(1, "ZED", [
        { kind: "ats", team: "GB", is_best_bet: true },
        { kind: "underdog", team: "LAR" },
        { kind: "sudden_death", team: "GB" },
        { kind: "total", total_direction: "over" },
      ]),
      submission(2, "ABC", [
        { kind: "ats", team: "GB" },
        { kind: "total", total_direction: "under" },
      ]),
      submission(3, "NEW", []),
      submission(3, "OLD", [{ kind: "ats", team: "LAR" }]),
    ],
    error: null,
  });
  expect(await loadMatchupPicks(9)).toMatchObject({
    away: { team: "GB", picks: ["ABC", "ZED (BB) (SD)"] },
    home: { team: "LAR", picks: ["ZED (UD)"] },
    awaySpread: -3.5,
    total: 45.5,
    over: ["ZED"],
    under: ["ABC"],
  });
  expect(eq).toHaveBeenCalledWith("pool_weeks.season_id", 42);
  expect(eq).toHaveBeenCalledWith("picks.game_id", 9);
});

it.each([
  { ...game, status: "scheduled", kickoff_at: "2099-11-26T01:00:00Z" },
  { ...game, status: "postponed" },
  null,
])("returns no breakdown for an unavailable matchup", async (data) => {
  gameLookup.mockResolvedValue({ data, error: null });
  expect(await loadMatchupPicks(9)).toBeNull();
  expect(rows).not.toHaveBeenCalled();
});
