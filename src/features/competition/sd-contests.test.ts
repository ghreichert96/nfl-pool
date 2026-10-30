import { describe, it, expect } from "vitest";
import { scoreSdContest, type SdContest } from "./sd-contests";
import { sidePoolPayout, type ScoringGame, type ScoringPick } from "./scoring";
const contest: SdContest = {
  id: 2,
  number: 2,
  start_week: 8,
  end_week: 18,
  strike_limit: 2,
  pot: 225,
  completed_week: null,
};
const game = (week: number): ScoringGame => ({
  id: week,
  weekId: week,
  weekNumber: week,
  away: "BUF",
  home: "MIA",
  awaySpread: 0,
  total: 40,
  awayScore: 30,
  homeScore: 10,
  status: "final",
});
const pick = (
  entryId: number,
  week: number,
  team = "BUF",
  sdContestId = 2,
): ScoringPick => ({
  entryId,
  gameId: week,
  kind: "sudden_death",
  team,
  totalDirection: null,
  isBestBet: false,
  sdContestId,
});
describe("independent SD contests", () => {
  it("resets strikes, ignores SD1 picks and pre-start omissions", () => {
    const result = scoreSdContest(
      contest,
      [1, 2],
      [game(1), game(7), game(8)],
      [pick(1, 1, "MIA", 1), pick(1, 7, "MIA", 1), pick(1, 8), pick(2, 8)],
    );
    expect(result.standings.map((s) => s.suddenDeathStrikes)).toEqual([0, 0]);
    expect(scoreSdContest(contest, [1, 2], [game(7)], [], 7).started).toBe(
      false,
    );
  });
  it("does not strike the locked opener when a later Week 8 game remains to pick", () => {
    const opener = { ...game(8), id: 80 };
    const later = {
      ...game(8),
      id: 81,
      weekId: 8,
      away: "KC",
      home: "DEN",
      status: "scheduled" as const,
      awayScore: null,
      homeScore: null,
    };
    const chosen: ScoringPick = { ...pick(1, 8, "KC"), gameId: 81 };
    const inProgress = scoreSdContest(
      contest,
      [1, 2],
      [opener, later],
      [chosen],
      8,
    );
    expect(inProgress.standings.map((s) => s.suddenDeathStrikes)).toEqual([
      0, 0,
    ]);

    const final = scoreSdContest(
      contest,
      [1, 2],
      [opener, { ...later, status: "final", awayScore: 30, homeScore: 20 }],
      [chosen],
    );
    expect(final.standings.map((s) => s.suddenDeathStrikes)).toEqual([0, 1]);
  });
  it("stops strikes at a sole survivor and keeps later omissions out", () => {
    const result = scoreSdContest(
      contest,
      [1, 2],
      [game(8), game(9), game(10)],
      [pick(1, 8), pick(2, 8, "MIA"), pick(1, 9), pick(2, 9, "MIA")],
    );
    expect(result.completedWeek).toBe(9);
    expect(
      result.standings.map((s) => [s.suddenDeathStrikes, s.eliminated]),
    ).toEqual([
      [0, false],
      [2, true],
    ]);
  });
  it("supports one strike and the whole-field reprieve", () => {
    const one = { ...contest, strike_limit: 1 };
    expect(
      scoreSdContest(one, [1, 2], [game(8)], [pick(1, 8), pick(2, 8, "MIA")])
        .completedWeek,
    ).toBe(8);
    expect(
      scoreSdContest(one, [1, 2], [game(8)], []).standings.map(
        (s) => s.suddenDeathStrikes,
      ),
    ).toEqual([0, 0]);
  });
  it("preserves ties and closes at the season end with multiple survivors", () => {
    const tied = { ...game(8), homeScore: 30 };
    const result = scoreSdContest(
      contest,
      [1, 2],
      [tied, game(18)],
      [pick(1, 8), pick(2, 8), pick(1, 18), pick(2, 18)],
    );
    expect(result.completedWeek).toBe(18);
    expect(result.standings.map((s) => s.suddenDeathStrikes)).toEqual([0, 0]);
    expect(sidePoolPayout(1, [1, 2, 3], [1, 2], 225)).toBe(112.5);
    expect(sidePoolPayout(3, [1, 2, 3], [1, 2], 225)).toBe(-225);
  });
  it("SD2 results cannot change finalized SD1 history", () => {
    const sd1 = {
      ...contest,
      id: 1,
      number: 1,
      start_week: 1,
      end_week: 7,
      completed_week: 7,
    };
    const picks = [
      pick(1, 1, "BUF", 1),
      pick(2, 1, "MIA", 1),
      pick(1, 7, "BUF", 1),
      pick(2, 7, "MIA", 1),
    ];
    const before = scoreSdContest(sd1, [1, 2], [game(1), game(7)], picks);
    const after = scoreSdContest(
      sd1,
      [1, 2],
      [game(1), game(7), game(8)],
      [...picks, pick(1, 8, "MIA"), pick(2, 8)],
    );
    expect(after).toEqual(before);
  });
});
