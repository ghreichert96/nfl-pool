import {
  calculateStandings,
  type ScoringGame,
  type ScoringPick,
} from "./scoring";
export type SdContest = {
  id: number;
  number: number;
  start_week: number;
  end_week: number;
  strike_limit: number;
  pot: number | string;
  completed_week: number | null;
};
export function scoreSdContest(
  contest: SdContest,
  participantIds: number[],
  games: ScoringGame[],
  picks: ScoringPick[],
  throughWeek = Infinity,
) {
  const eligibleGames = games.filter(
    (g) =>
      g.weekNumber >= contest.start_week &&
      g.weekNumber <=
        Math.min(contest.completed_week ?? contest.end_week, throughWeek),
  );
  const standings = calculateStandings(
    participantIds,
    eligibleGames,
    picks.filter(
      (p) => p.kind === "sudden_death" && p.sdContestId === contest.id,
    ),
    { strikeLimit: contest.strike_limit, stopAtWinner: true },
  );
  const lastWeekGames = eligibleGames.filter(
    (g) => g.weekNumber === (contest.completed_week ?? contest.end_week),
  );
  const completedWeek =
    standings[0]?.sdCompletedWeek ??
    (lastWeekGames.length && lastWeekGames.every((g) => g.status === "final")
      ? (contest.completed_week ?? contest.end_week)
      : null);
  return {
    ...contest,
    participantIds,
    standings,
    completedWeek,
    started: throughWeek >= contest.start_week,
  };
}
export type SdResult = ReturnType<typeof scoreSdContest>;
export function sdBeforeWeek(
  contest: SdResult,
  games: ScoringGame[],
  picks: ScoringPick[],
  week: number,
) {
  return scoreSdContest(
    contest,
    contest.participantIds,
    games,
    picks,
    week - 1,
  );
}
