export type LineObservation = {
  bookmaker: string;
  point: number;
};

function isHalfPoint(value: number) {
  return Math.abs(value * 2) % 2 === 1;
}

export function consensusPoint(observations: LineObservation[]) {
  const valid = observations.filter(
    (observation) =>
      observation.bookmaker.length > 0 && Number.isFinite(observation.point),
  );
  if (valid.length === 0) return null;

  const counts = new Map<number, number>();
  for (const observation of valid) {
    counts.set(observation.point, (counts.get(observation.point) ?? 0) + 1);
  }

  const maxCount = Math.max(...counts.values());
  const tied = [...counts.entries()]
    .filter(([, count]) => count === maxCount)
    .map(([point]) => point);
  const preferred = tied.some(isHalfPoint) ? tied.filter(isHalfPoint) : tied;
  const sortedAll = valid.map(({ point }) => point).sort((a, b) => a - b);
  const middle = (sortedAll.length - 1) / 2;
  const marketMedian =
    (sortedAll[Math.floor(middle)] + sortedAll[Math.ceil(middle)]) / 2;

  return preferred.sort(
    (a, b) => Math.abs(a - marketMedian) - Math.abs(b - marketMedian) || a - b,
  )[0];
}

export function consensusLine(input: {
  spreads: LineObservation[];
  totals: LineObservation[];
}) {
  return {
    awaySpread: consensusPoint(input.spreads),
    total: consensusPoint(input.totals),
    spreadBooks: new Set(input.spreads.map(({ bookmaker }) => bookmaker)).size,
    totalBooks: new Set(input.totals.map(({ bookmaker }) => bookmaker)).size,
  };
}
