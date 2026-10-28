import {
  calculateStandings,
  rankStandings,
  ranksByGamesBack,
  sameRank,
  type EntryStanding,
  type ScoringGame,
  type ScoringPick,
} from "./scoring";
export function sideOrder(
  standings: EntryStanding[],
  entries: { id: number; entry_code: string }[],
  kind: "sd" | "ud",
) {
  const scores = new Map(standings.map((row) => [row.entryId, row]));
  const compare = (a: number, b: number) => {
    const left = scores.get(a),
      right = scores.get(b);
    if (kind === "ud")
      return (right?.underdogPoints ?? 0) - (left?.underdogPoints ?? 0);
    const strikes =
      (left?.suddenDeathStrikes ?? 0) - (right?.suddenDeathStrikes ?? 0);
    if (strikes) return strikes;
    // Compare most recent strike first, then the earlier strike. Later is better.
    const leftWeeks = [...(left?.suddenDeathStrikeWeeks ?? [])].reverse();
    const rightWeeks = [...(right?.suddenDeathStrikeWeeks ?? [])].reverse();
    for (let i = 0; i < Math.max(leftWeeks.length, rightWeeks.length); i++) {
      const timing = (rightWeeks[i] ?? 0) - (leftWeeks[i] ?? 0);
      if (timing) return timing;
    }
    return 0;
  };
  const ordered = [...entries].sort(
    (a, b) => compare(a.id, b.id) || a.entry_code.localeCompare(b.entry_code),
  );
  const ranks = new Map<number, number>();
  ordered.forEach((entry, index) =>
    ranks.set(
      entry.id,
      index > 0 && compare(entry.id, ordered[index - 1].id) === 0
        ? ranks.get(ordered[index - 1].id)!
        : index + 1,
    ),
  );
  return { ordered, ranks };
}
export type PerformancePoint = {
  week: number;
  standings: number;
  overall: number;
  weekly: number;
  provisional: boolean;
};
export function performanceHistory(
  entryIds: number[],
  games: (ScoringGame & { kickoffAt?: string })[],
  picks: ScoringPick[],
  now = Date.now(),
) {
  const history = new Map<number, PerformancePoint[]>(
    entryIds.map((id) => [id, []]),
  );
  const weekNumbers = [...new Set(games.map((game) => game.weekNumber))].sort(
    (a, b) => a - b,
  );
  for (const week of weekNumbers) {
    const slate = games.filter((g) => g.weekNumber === week);
    if (
      !slate.some(
        (g) =>
          g.status === "live" ||
          g.status === "final" ||
          (g.kickoffAt && Date.parse(g.kickoffAt) <= now),
      )
    )
      continue;
    const cumulative = ranksByGamesBack(
      rankStandings(
        calculateStandings(
          entryIds,
          games.filter((g) => g.weekNumber <= week),
          picks,
        ),
      ),
    );
    const weekly = ranksByGamesBack(
      rankStandings(calculateStandings(entryIds, slate, picks)),
    );
    for (const id of entryIds)
      history.get(id)!.push({
        week,
        standings: cumulative.get(id)!,
        overall: cumulative.get(id)!,
        weekly: weekly.get(id)!,
        provisional: slate.some((g) => g.status !== "final"),
      });
  }
  return history;
}
export function mainPayoutExplanation(
  entryId: number,
  standings: EntryStanding[],
  schedule: { rank: number; amount: number | string }[],
) {
  const index = standings.findIndex((s) => s.entryId === entryId);
  if (index < 0) return "No ranked results.";
  const tied = standings.filter((s) => sameRank(s, standings[index]));
  const rank = standings.findIndex((s) => sameRank(s, standings[index])) + 1;
  const amounts = Array.from({ length: tied.length }, (_, i) =>
    Number(schedule.find((p) => p.rank === rank + i)?.amount ?? 0),
  );
  return `Rank ${rank}${tied.length > 1 ? ` · ${tied.length} tied entries` : ""}. Rank ${tied.length > 1 ? `slots ${rank}–${rank + tied.length - 1}` : rank}: ${amounts.map((n) => `$${n.toFixed(2)}`).join(" + ")}${tied.length > 1 ? ` ÷ ${tied.length}` : ""}.`;
}
