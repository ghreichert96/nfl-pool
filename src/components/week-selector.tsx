"use client";

import { startNavigation } from "./navigation-progress";

export function WeekSelector({
  weeks,
  selected,
  preserve = {},
}: {
  weeks: { week_number: number; label: string }[];
  selected: number;
  preserve?: Record<string, string>;
}) {
  return (
    <form method="get">
      {Object.entries(preserve).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <select
        aria-label="Week"
        name="week"
        defaultValue={selected}
        onChange={(event) => {
          startNavigation();
          event.currentTarget.form?.requestSubmit();
        }}
        className="control-raised min-h-9 rounded-md border px-2 text-xs font-black"
      >
        {weeks.map((week) => (
          <option key={week.week_number} value={week.week_number}>
            Week {week.week_number}
          </option>
        ))}
      </select>
      <button className="sr-only" type="submit">
        Go
      </button>
    </form>
  );
}
