export type Team = {
  abbreviation: string;
  name: string;
};

export type Game = {
  id: string;
  away: Team;
  home: Team;
  awaySpread: number;
  total: number;
  badge: string;
  kickoff: string;
  location: string;
  locked?: boolean;
  result?: {
    atsWinner: string | null;
    totalWinner: "over" | "under" | null;
    winner: string | null;
  };
};

export type TeamPick = {
  gameId: string;
  team: string;
};

export type TotalPick = {
  gameId: string;
  direction: "over" | "under";
};

export type Picks = {
  ats: TeamPick[];
  totals: TotalPick[];
  bestBet: TeamPick | null;
  suddenDeath: TeamPick | null;
  underdog: TeamPick | null;
};

export const EMPTY_PICKS: Picks = {
  ats: [],
  totals: [],
  bestBet: null,
  suddenDeath: null,
  underdog: null,
};

export const pickKey = (pick: TeamPick) => `${pick.gameId}:${pick.team}`;

export const spreadFor = (game: Game, team: string) =>
  team === game.away.abbreviation ? game.awaySpread : -game.awaySpread;

export const favoriteFor = (game: Game) =>
  game.awaySpread < 0 ? game.away.abbreviation : game.home.abbreviation;

export const underdogFor = (game: Game) =>
  game.awaySpread > 0 ? game.away.abbreviation : game.home.abbreviation;

export function formatSpread(spread: number) {
  if (spread === 0) return "PK";
  return spread > 0 ? `+${spread}` : String(spread);
}

export function toggleTeamPick(
  picks: TeamPick[],
  next: TeamPick,
  limit: number,
) {
  const sameGame = picks.find((pick) => pick.gameId === next.gameId);

  if (sameGame && sameGame.team === next.team) {
    return picks.filter((pick) => pickKey(pick) !== pickKey(next));
  }

  if (sameGame) {
    return picks.map((pick) => (pick.gameId === next.gameId ? next : pick));
  }

  return picks.length < limit ? [...picks, next] : picks;
}

export function toggleTotalPick(
  picks: TotalPick[],
  next: TotalPick,
  limit: number,
) {
  const sameGame = picks.find((pick) => pick.gameId === next.gameId);

  if (sameGame?.direction === next.direction) {
    return picks.filter((pick) => pick.gameId !== next.gameId);
  }

  if (sameGame) {
    return picks.map((pick) => (pick.gameId === next.gameId ? next : pick));
  }

  return picks.length < limit ? [...picks, next] : picks;
}

export function validationMessage(picks: Picks) {
  const missing = [
    picks.ats.length === 6 ? null : `${6 - picks.ats.length} ATS`,
    picks.totals.length === 3 ? null : `${3 - picks.totals.length} O/U`,
    picks.bestBet ? null : "Best Bet",
    picks.suddenDeath ? null : "Sudden Death",
    picks.underdog ? null : "Underdog",
  ].filter(Boolean);

  return missing.length === 0
    ? "All required picks selected."
    : `Still needed: ${missing.join(", ")}.`;
}
