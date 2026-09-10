export type Outcome = "win" | "loss" | "tie" | "pending";

export type ScoringGame = {
  id: number;
  weekId: number;
  weekNumber: number;
  away: string;
  home: string;
  awaySpread: number;
  total: number;
  awayScore: number | null;
  homeScore: number | null;
  status: string;
};

export type ScoringPick = {
  entryId: number;
  gameId: number;
  kind: "ats" | "total" | "sudden_death" | "underdog";
  team: string | null;
  totalDirection: "over" | "under" | null;
  isBestBet: boolean;
};

export type EntryStanding = {
  entryId: number;
  wins: number;
  losses: number;
  ties: number;
  underdogPoints: number;
  suddenDeathStrikes: number;
  eliminated: boolean;
};

export type RecordSummary = { wins: number; losses: number; ties: number };

export function recordForPicks(
  games: ScoringGame[],
  picks: ScoringPick[],
  kinds: Array<ScoringPick["kind"]>,
  doubleBestBet = false,
): RecordSummary {
  const gameMap = new Map(games.map((game) => [game.id, game]));
  const record = { wins: 0, losses: 0, ties: 0 };
  for (const pick of picks) {
    if (!kinds.includes(pick.kind)) continue;
    const game = gameMap.get(pick.gameId);
    if (!game) continue;
    const outcome = pickOutcome(game, pick);
    if (outcome === "pending") continue;
    const weight = doubleBestBet && pick.isBestBet ? 2 : 1;
    record[`${outcome}s` as "wins" | "losses" | "ties"] += weight;
  }
  return record;
}

export function teamOutcome(
  game: ScoringGame,
  team: string,
  ats = false,
): Outcome {
  if (
    game.status !== "final" ||
    game.awayScore === null ||
    game.homeScore === null
  )
    return "pending";
  const awayValue = game.awayScore + (ats ? game.awaySpread : 0);
  const homeValue = game.homeScore;
  const picked = team === game.away ? awayValue : homeValue;
  const opponent = team === game.away ? homeValue : awayValue;
  return picked === opponent ? "tie" : picked > opponent ? "win" : "loss";
}

export function totalOutcome(
  game: ScoringGame,
  direction: "over" | "under",
): Outcome {
  if (
    game.status !== "final" ||
    game.awayScore === null ||
    game.homeScore === null
  )
    return "pending";
  const scored = game.awayScore + game.homeScore;
  if (scored === game.total) return "tie";
  return scored > game.total === (direction === "over") ? "win" : "loss";
}

export function pickOutcome(game: ScoringGame, pick: ScoringPick): Outcome {
  if (pick.kind === "total") return totalOutcome(game, pick.totalDirection!);
  if (pick.kind === "ats") return teamOutcome(game, pick.team!, true);
  if (pick.kind === "sudden_death" && teamOutcome(game, pick.team!) === "tie")
    return "tie";
  return teamOutcome(game, pick.team!);
}

export function calculateStandings(
  entryIds: number[],
  games: ScoringGame[],
  picks: ScoringPick[],
): EntryStanding[] {
  const gameMap = new Map(games.map((game) => [game.id, game]));
  const finalWeeks = new Map<number, ScoringGame[]>();
  for (const game of games) {
    const weekGames = finalWeeks.get(game.weekId) ?? [];
    weekGames.push(game);
    finalWeeks.set(game.weekId, weekGames);
  }

  const standings = entryIds.map((entryId) => {
    const entryPicks = picks.filter((pick) => pick.entryId === entryId);
    let wins = 0,
      losses = 0,
      ties = 0,
      underdogPoints = 0;
    for (const pick of entryPicks) {
      const game = gameMap.get(pick.gameId);
      if (!game) continue;
      const outcome = pickOutcome(game, pick);
      if (pick.kind === "ats" || pick.kind === "total") {
        const weight = pick.isBestBet ? 2 : 1;
        if (outcome === "win") wins += weight;
        if (outcome === "loss") losses += weight;
        if (outcome === "tie") ties += weight;
      } else if (pick.kind === "underdog" && outcome === "win") {
        underdogPoints += Math.abs(
          pick.team === game.away ? game.awaySpread : -game.awaySpread,
        );
      }
    }

    for (const [weekId, weekGames] of finalWeeks) {
      if (
        !weekGames.length ||
        weekGames.some((game) => game.status !== "final")
      )
        continue;
      const weekPicks = entryPicks.filter(
        (pick) => gameMap.get(pick.gameId)?.weekId === weekId,
      );
      const main = weekPicks.filter(
        (pick) => pick.kind === "ats" || pick.kind === "total",
      );
      const decidedMain = main.filter(
        (pick) => pickOutcome(gameMap.get(pick.gameId)!, pick) !== "pending",
      );
      losses += Math.max(0, 9 - decidedMain.length);
      if (!main.some((pick) => pick.isBestBet)) losses += 1;
    }
    return {
      entryId,
      wins,
      losses,
      ties,
      underdogPoints,
      suddenDeathStrikes: 0,
      eliminated: false,
    };
  });

  const standingMap = new Map(
    standings.map((standing) => [standing.entryId, standing]),
  );
  for (const [, weekGames] of [...finalWeeks].sort(
    (a, b) => a[1][0].weekNumber - b[1][0].weekNumber,
  )) {
    if (!weekGames.length || weekGames.some((game) => game.status !== "final"))
      continue;
    const active = standings.filter((standing) => !standing.eliminated);
    const deltas = new Map<number, number>();
    for (const standing of active) {
      const sdPick = picks.find(
        (pick) =>
          pick.entryId === standing.entryId &&
          pick.kind === "sudden_death" &&
          weekGames.some((game) => game.id === pick.gameId),
      );
      const game = sdPick ? gameMap.get(sdPick.gameId) : undefined;
      deltas.set(
        standing.entryId,
        !sdPick ? 1 : game && pickOutcome(game, sdPick) === "loss" ? 1 : 0,
      );
    }
    const allWouldExit =
      active.length > 0 &&
      active.every(
        (standing) =>
          standing.suddenDeathStrikes + (deltas.get(standing.entryId) ?? 0) >=
          2,
      );
    for (const standing of active) {
      const delta = allWouldExit ? 0 : (deltas.get(standing.entryId) ?? 0);
      const target = standingMap.get(standing.entryId)!;
      target.suddenDeathStrikes += delta;
      target.eliminated = target.suddenDeathStrikes >= 2;
    }
  }
  return standings;
}

export function gamesBack(standing: EntryStanding, all: EntryStanding[]) {
  if (!all.length) return 0;
  return (
    (Math.max(...all.map((item) => item.wins)) -
      standing.wins +
      (standing.losses - Math.min(...all.map((item) => item.losses)))) /
    2
  );
}

export function rankStandings(standings: EntryStanding[]) {
  return [...standings].sort(
    (a, b) =>
      gamesBack(a, standings) - gamesBack(b, standings) ||
      b.wins - a.wins ||
      a.entryId - b.entryId,
  );
}

export function payoutForRank(rank: number, schedule: Map<number, number>) {
  return schedule.get(rank) ?? 0;
}

export function sharedRankPayout(
  startRank: number,
  tieCount: number,
  schedule: Map<number, number>,
) {
  return (
    Array.from({ length: tieCount }, (_, index) =>
      payoutForRank(startRank + index, schedule),
    ).reduce((sum, value) => sum + value, 0) / tieCount
  );
}

export function sidePoolPayout(
  entryId: number,
  allEntryIds: number[],
  winnerEntryIds: number[],
  pot = 200,
) {
  if (allEntryIds.length === 0 || winnerEntryIds.length === allEntryIds.length)
    return 0;
  return winnerEntryIds.includes(entryId)
    ? pot / winnerEntryIds.length
    : -pot / (allEntryIds.length - winnerEntryIds.length);
}
