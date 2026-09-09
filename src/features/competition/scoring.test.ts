import { describe, expect, it } from "vitest";
import {
  calculateStandings,
  gamesBack,
  sharedRankPayout,
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
