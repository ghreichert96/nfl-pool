export type Freshness = { label: string; stale: boolean };

export function updatedLabel(
  updatedAt: string | null | undefined,
  now: number,
): string {
  if (!updatedAt || !Number.isFinite(Date.parse(updatedAt))) return "Pending";
  const minutes = Math.max(
    0,
    Math.floor((now - Date.parse(updatedAt)) / 60_000),
  );
  return minutes < 1
    ? "Now"
    : minutes < 60
      ? `${minutes}m`
      : `${Math.floor(minutes / 60)}h`;
}

export function scoreFreshness(
  games: {
    status: string;
    kickoff_at: string;
    live_status_updated_at: string | null;
  }[],
  now: number,
): Freshness | undefined {
  const active = games.filter(
    (g) =>
      ["scheduled", "live"].includes(g.status) &&
      Date.parse(g.kickoff_at) <= now,
  );
  if (!active.length) return undefined;
  // One healthy game must not hide another game's stalled feed. A never-updated
  // game starts its grace period at kickoff, not at the last unrelated update.
  const stale = active.some(
    (g) =>
      now -
        Math.max(
          Date.parse(g.kickoff_at),
          Date.parse(g.live_status_updated_at ?? "") || 0,
        ) >=
      2 * 60 * 60 * 1000,
  );
  const oldest = active.some((g) => !g.live_status_updated_at)
    ? null
    : active.map((g) => g.live_status_updated_at!).sort()[0];
  return { label: updatedLabel(oldest, now), stale };
}
