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

export type SelectedLine = {
  point: number;
  bookmaker: string;
  observedAt: string | null;
  fallback: string | null;
};
export function preferredLine(
  observations: (LineObservation & { observedAt?: string | null })[],
  previousAt?: string | null,
): SelectedLine | null {
  const valid = observations.filter(
    (o) =>
      Number.isFinite(o.point) &&
      Number.isInteger(o.point * 2) &&
      o.bookmaker &&
      (!o.observedAt || Number.isFinite(Date.parse(o.observedAt))) &&
      (!previousAt ||
        (o.observedAt && Date.parse(o.observedAt) >= Date.parse(previousAt))),
  );
  for (const book of ["draftkings", "betmgm", "fanduel"]) {
    const observation = valid
      .filter((o) => o.bookmaker === book)
      .sort(
        (a, b) =>
          Date.parse(b.observedAt ?? "1970-01-01") -
          Date.parse(a.observedAt ?? "1970-01-01"),
      )[0];
    if (observation)
      return {
        point: observation.point,
        bookmaker: book,
        observedAt: observation.observedAt ?? null,
        fallback:
          book === "draftkings" ? null : "Preferred book unavailable or stale",
      };
  }
  const unique = [
    ...new Map(
      [...valid]
        .sort(
          (a, b) =>
            Date.parse(a.observedAt ?? "1970-01-01") -
              Date.parse(b.observedAt ?? "1970-01-01") || a.point - b.point,
        )
        .map((o) => [o.bookmaker, o]),
    ).values(),
  ];
  const point = consensusPoint(unique);
  return point === null
    ? null
    : {
        point,
        bookmaker: "consensus",
        observedAt:
          unique
            .filter((o) => o.observedAt)
            .map((o) => o.observedAt!)
            .sort()
            .at(-1) ?? null,
        fallback: "Preferred books unavailable or stale",
      };
}
