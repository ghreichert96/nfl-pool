import { describe, expect, it } from "vitest";
import {
  calculateStandings,
  gamesBack,
  sharedRankPayout,
  sidePoolPayout,
  teamOutcome,
  totalOutcome,
  type ScoringGame,
} from "./scoring";

const game: ScoringGame = {
  id: 1,
  weekId: 1,
  weekNumber: 1,
  away: "DOG",
  home: "FAV",
  awaySpread: 3.5,
  total: 44,
  awayScore: 24,
  homeScore: 20,
  status: "final",
};

describe("competition scoring", () => {
  it("scores ATS, totals, and outright results", () => {
    expect(teamOutcome(game, "DOG", true)).toBe("win");
    expect(teamOutcome(game, "DOG")).toBe("win");
    expect(totalOutcome(game, "over")).toBe("tie");
  });
  it("weights BB and awards a winning underdog its frozen spread", () => {
    const [standing] = calculateStandings(
      [1],
      [game],
      [
        {
          entryId: 1,
          gameId: 1,
          kind: "ats",
          team: "DOG",
          totalDirection: null,
          isBestBet: true,
        },
        {
          entryId: 1,
          gameId: 1,
          kind: "underdog",
          team: "DOG",
          totalDirection: null,
          isBestBet: false,
        },
        {
          entryId: 1,
          gameId: 1,
          kind: "sudden_death",
          team: "DOG",
          totalDirection: null,
          isBestBet: false,
        },
      ],
    );
    expect(standing.wins).toBe(2);
    expect(standing.underdogPoints).toBe(3.5);
  });
  it("uses the pool GB formula and averages tied payout slots", () => {
    const all = [
      {
        entryId: 1,
        wins: 10,
        losses: 2,
        ties: 0,
        underdogPoints: 0,
        suddenDeathStrikes: 0,
        eliminated: false,
      },
      {
        entryId: 2,
        wins: 8,
        losses: 4,
        ties: 0,
        underdogPoints: 0,
        suddenDeathStrikes: 1,
        eliminated: false,
      },
    ];
    expect(gamesBack(all[1], all)).toBe(2);
    expect(
      sharedRankPayout(
        2,
        2,
        new Map([
          [2, 250],
          [3, 200],
        ]),
      ),
    ).toBe(225);
    expect(
      sharedRankPayout(
        3,
        3,
        new Map([
          [3, 250],
          [4, 200],
          [5, 150],
        ]),
      ),
    ).toBe(200);
  });
  it("balances projected side-pool winners and non-winners", () => {
    const all = [1, 2, 3, 4];
    expect(sidePoolPayout(1, all, [1, 2])).toBe(100);
    expect(sidePoolPayout(4, all, [1, 2])).toBe(-100);
    expect(sidePoolPayout(1, all, all)).toBe(0);
  });
  it("charges Main omissions only when every game in the week is final", () => {
    expect(
      calculateStandings([1], [{ ...game, status: "live" }], [])[0],
    ).toMatchObject({
      wins: 0,
      losses: 0,
      ties: 0,
    });
    expect(calculateStandings([1], [game], [])[0]).toMatchObject({
      wins: 0,
      losses: 10,
      ties: 0,
    });
  });
  it("recalculates corrected finals without retaining the prior outcome", () => {
    const pick = {
      entryId: 1,
      gameId: 1,
      kind: "ats" as const,
      team: "DOG",
      totalDirection: null,
      isBestBet: false,
    };
    expect(calculateStandings([1], [game], [pick])[0].wins).toBe(1);
    expect(
      calculateStandings(
        [1],
        [{ ...game, awayScore: 10, homeScore: 24 }],
        [pick],
      )[0].losses,
    ).toBe(10);
  });
  it("gives no UD points and no SD strike for an outright tie", () => {
    const tied = { ...game, awayScore: 20, homeScore: 20 };
    const [standing] = calculateStandings(
      [1],
      [tied],
      [
        {
          entryId: 1,
          gameId: 1,
          kind: "underdog",
          team: "DOG",
          totalDirection: null,
          isBestBet: false,
        },
        {
          entryId: 1,
          gameId: 1,
          kind: "sudden_death",
          team: "DOG",
          totalDirection: null,
          isBestBet: false,
        },
      ],
    );
    expect(standing.underdogPoints).toBe(0);
    expect(standing.suddenDeathStrikes).toBe(0);
  });
  it("charges a missing SD pick but waives a simultaneous field wipeout", () => {
    const weekTwo = { ...game, id: 2, weekId: 2, weekNumber: 2 };
    const standings = calculateStandings(
      [1, 2],
      [game, weekTwo],
      [
        {
          entryId: 1,
          gameId: 1,
          kind: "sudden_death",
          team: "FAV",
          totalDirection: null,
          isBestBet: false,
        },
        {
          entryId: 2,
          gameId: 1,
          kind: "sudden_death",
          team: "FAV",
          totalDirection: null,
          isBestBet: false,
        },
      ],
    );
    expect(standings.map((item) => item.suddenDeathStrikes)).toEqual([1, 1]);
    expect(standings.every((item) => !item.eliminated)).toBe(true);
  });
});
