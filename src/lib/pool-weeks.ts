export type SelectablePoolWeek = {
  week_number: number;
  lines_freeze_at: string;
};

const rolloverOffsetMs = 66 * 60 * 60 * 1000;

export function weekRolloverAt(week: SelectablePoolWeek) {
  return new Date(new Date(week.lines_freeze_at).getTime() - rolloverOffsetMs);
}

export function selectPoolWeek<T extends SelectablePoolWeek>(
  weeks: T[],
  requestedWeek: number,
  now = new Date(),
) {
  const requested = weeks.find((week) => week.week_number === requestedWeek);
  if (requested) return requested;
  const eligible = weeks.filter(
    (week) => weekRolloverAt(week).getTime() <= now.getTime(),
  );
  return eligible.at(-1) ?? weeks[0] ?? null;
}
