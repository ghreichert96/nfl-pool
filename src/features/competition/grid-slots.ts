import type { ScoringPick } from "./scoring";
export type PickCounts = {
  ats_count: number;
  total_count: number;
  has_best_bet: boolean;
  has_underdog: boolean;
  has_sudden_death: boolean;
};
export type GridSlot<T> = T | "hidden" | null;
export function gridSlots<T extends ScoringPick>(
  picks: T[],
  counts?: PickCounts,
): GridSlot<T>[] {
  const bb = picks.find((p) => p.kind === "ats" && p.isBestBet);
  const ats = picks.filter((p) => p.kind === "ats" && !p.isBestBet);
  const totals = picks.filter((p) => p.kind === "total");
  const hasBB = Boolean(bb || counts?.has_best_bet);
  const regularCount = Math.max(
    ats.length,
    (counts?.ats_count ?? 0) - Number(hasBB),
  );
  const regular: GridSlot<T>[] = Array.from(
    { length: regularCount },
    (_, i) => ats[i] ?? "hidden",
  );
  // A complete six-ATS submission without a BB still shows all six selections.
  const first =
    bb ?? (hasBB ? "hidden" : regularCount > 5 ? regular.shift()! : null);
  return [
    first,
    ...Array.from({ length: 5 }, (_, i) => regular[i] ?? null),
    ...Array.from(
      { length: 3 },
      (_, i) => totals[i] ?? (i < (counts?.total_count ?? 0) ? "hidden" : null),
    ),
    picks.find((p) => p.kind === "underdog") ??
      (counts?.has_underdog ? "hidden" : null),
    picks.find((p) => p.kind === "sudden_death") ??
      (counts?.has_sudden_death ? "hidden" : null),
  ];
}
