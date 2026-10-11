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
  const compare = (a: number, b: number) =>
    kind === "ud"
      ? (scores.get(b)?.underdogPoints ?? 0) -
        (scores.get(a)?.underdogPoints ?? 0)
      : Number(scores.get(a)?.eliminated ?? false) -
          Number(scores.get(b)?.eliminated ?? false) ||
        (scores.get(a)?.suddenDeathStrikes ?? 0) -
          (scores.get(b)?.suddenDeathStrikes ?? 0);
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
