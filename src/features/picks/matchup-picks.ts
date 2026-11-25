export type MatchupPicks = {
  away: { team: string; logo?: string | null; picks: string[] };
  home: { team: string; logo?: string | null; picks: string[] };
  awaySpread: number | null;
  total: number | null;
  over: string[];
  under: string[];
};

export function canShowMatchupPicks(
  status: string,
  kickoff: string,
  now: number,
) {
  return (
    (status === "scheduled" || status === "live" || status === "final") &&
    Date.parse(kickoff) <= now
  );
}
