import { z } from "zod";

import type { Game, Picks, TeamPick, TotalPick } from "./model";

const teamPickSchema = z.object({
  gameId: z.string().min(1),
  team: z.string().regex(/^[A-Z]{2,3}$/),
});

const totalPickSchema = z.object({
  gameId: z.string().min(1),
  direction: z.enum(["over", "under"]),
});

export const picksSchema = z.object({
  ats: z.array(teamPickSchema).max(6),
  totals: z.array(totalPickSchema).max(3),
  bestBet: teamPickSchema.nullable(),
  suddenDeath: teamPickSchema.nullable(),
  underdog: teamPickSchema.nullable(),
});

export type SubmissionPick = {
  gameId: string;
  kind: "ats" | "total" | "sudden_death" | "underdog";
  team: string | null;
  totalDirection: "over" | "under" | null;
  isBestBet: boolean;
};

function isLocked(gameId: string, games: Game[]) {
  return games.find((game) => game.id === gameId)?.status !== "upcoming";
}

function mergeTeamPicks(draft: TeamPick[], saved: TeamPick[], games: Game[]) {
  const unlocked = draft.filter((pick) => !isLocked(pick.gameId, games));
  const locked = saved.filter((pick) => isLocked(pick.gameId, games));
  return [...locked, ...unlocked];
}

function mergeTotalPicks(
  draft: TotalPick[],
  saved: TotalPick[],
  games: Game[],
) {
  const unlocked = draft.filter((pick) => !isLocked(pick.gameId, games));
  const locked = saved.filter((pick) => isLocked(pick.gameId, games));
  return [...locked, ...unlocked];
}

export function preserveLockedPicks(
  draft: Picks,
  saved: Picks,
  games: Game[],
): Picks {
  const ats = mergeTeamPicks(draft.ats, saved.ats, games);
  const totals = mergeTotalPicks(draft.totals, saved.totals, games);

  const lockedBestBet = saved.bestBet?.gameId
    ? isLocked(saved.bestBet.gameId, games)
    : false;
  const lockedSuddenDeath = saved.suddenDeath?.gameId
    ? isLocked(saved.suddenDeath.gameId, games)
    : false;
  const lockedUnderdog = saved.underdog?.gameId
    ? isLocked(saved.underdog.gameId, games)
    : false;

  return {
    ats,
    totals,
    bestBet: lockedBestBet ? saved.bestBet : draft.bestBet,
    suddenDeath: lockedSuddenDeath ? saved.suddenDeath : draft.suddenDeath,
    underdog: lockedUnderdog ? saved.underdog : draft.underdog,
  };
}

export function toSubmissionPicks(input: Picks): SubmissionPick[] {
  const picks = picksSchema.parse(input);

  return [
    ...picks.ats.map((pick) => ({
      gameId: pick.gameId,
      kind: "ats" as const,
      team: pick.team,
      totalDirection: null,
      isBestBet:
        picks.bestBet?.gameId === pick.gameId &&
        picks.bestBet.team === pick.team,
    })),
    ...picks.totals.map((pick) => ({
      gameId: pick.gameId,
      kind: "total" as const,
      team: null,
      totalDirection: pick.direction,
      isBestBet: false,
    })),
    ...(picks.suddenDeath
      ? [
          {
            gameId: picks.suddenDeath.gameId,
            kind: "sudden_death" as const,
            team: picks.suddenDeath.team,
            totalDirection: null,
            isBestBet: false,
          },
        ]
      : []),
    ...(picks.underdog
      ? [
          {
            gameId: picks.underdog.gameId,
            kind: "underdog" as const,
            team: picks.underdog.team,
            totalDirection: null,
            isBestBet: false,
          },
        ]
      : []),
  ];
}
