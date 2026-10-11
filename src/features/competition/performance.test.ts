import { describe, expect, it } from "vitest";
import {
  performanceHistory,
  sideOrder,
  mainPayoutExplanation,
} from "./performance";
import {
  sidePoolPayout,
  type EntryStanding,
  type ScoringGame,
  type ScoringPick,
} from "./scoring";
const base: EntryStanding = {
  entryId: 1,
  wins: 0,
  losses: 0,
  ties: 0,
  suddenDeathStrikes: 0,
  underdogPoints: 0,
  eliminated: false,
};
describe("entry performance", () => {
  it("uses competition ranks with stable entry-name order within SD/UD ties", () => {
    const entries = [
      { id: 1, entry_code: "ZZZZ" },
      { id: 2, entry_code: "AAAA" },
      { id: 3, entry_code: "BBBB" },
    ];
    const standings = [
      { ...base },
      { ...base, entryId: 2 },
      { ...base, entryId: 3, suddenDeathStrikes: 1, underdogPoints: -1 },
    ];
    for (const kind of ["sd", "ud"] as const) {
      const result = sideOrder(standings, entries, kind);
      expect(result.ordered.map((e) => e.id)).toEqual([2, 1, 3]);
      expect([...result.ranks.values()]).toEqual([1, 1, 3]);
    }
  });
  it("separates cumulative from weekly ranks, marks a started week provisional, and excludes future weeks", () => {
    const game: ScoringGame = {
      id: 1,
      weekId: 1,
      weekNumber: 1,
      away: "BUF",
      home: "MIA",
      awaySpread: 0,
      total: 40,
      awayScore: 20,
      homeScore: 10,
      status: "final",
    };
    const games = [
      game,
      { ...game, id: 2, weekId: 2, weekNumber: 2 },
      { ...game, id: 3, weekId: 3, weekNumber: 3, status: "live" },
      {
        ...game,
        id: 4,
        weekId: 4,
        weekNumber: 4,
        status: "scheduled",
        kickoffAt: "2099-01-01",
      },
    ];
    const pick: ScoringPick = {
      entryId: 1,
      gameId: 1,
      kind: "ats",
      team: "BUF",
      totalDirection: null,
      isBestBet: true,
    };
    const picks = [
      pick,
      { ...pick, entryId: 2, team: "MIA" },
      { ...pick, gameId: 2, team: "MIA", isBestBet: false },
      { ...pick, entryId: 2, gameId: 2, isBestBet: false },
    ];
    const history = performanceHistory(
      [1, 2],
      games,
      picks,
      Date.parse("2026-10-01"),
    );
    expect(history.get(1)?.map((p) => p.week)).toEqual([1, 2, 3]);
    expect(history.get(1)?.[1]).toMatchObject({ standings: 1, weekly: 2 });
    expect(history.get(1)?.[2].provisional).toBe(true);
  });
  it("explains occupied rank slots and balances independently configured side pots", () => {
    expect(
      mainPayoutExplanation(
        1,
        [base, { ...base, entryId: 2 }],
        [
          { rank: 1, amount: 350 },
          { rank: 2, amount: 300 },
        ],
      ),
    ).toContain("$350.00 + $300.00 ÷ 2");
    expect(sidePoolPayout(1, [1, 2, 3], [1], 225)).toBe(225);
    expect(sidePoolPayout(2, [1, 2, 3], [1], 225)).toBe(-112.5);
    expect(sidePoolPayout(1, [1, 2, 3], [1, 2], 225)).toBe(112.5);
    expect(sidePoolPayout(1, [1, 2, 3], [1, 2, 3], 225)).toBe(0);
  });
});
