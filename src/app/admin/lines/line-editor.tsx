"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { saveLine } from "./actions";

function Stepper({
  label,
  name,
  initial,
  min,
}: {
  label: string;
  name: string;
  initial: number;
  min?: number;
}) {
  const [value, setValue] = useState(initial);
  const update = (delta: number) =>
    setValue((current) => Math.max(min ?? -99, current + delta));
  return (
    <label className="grid gap-0.5 text-[9px] font-black uppercase text-slate-400">
      {label}
      <span className="flex items-stretch">
        <button
          type="button"
          aria-label={`Lower ${label}`}
          onClick={() => update(-0.5)}
          className="control-raised w-7 rounded-l border text-base"
        >
          −
        </button>
        <input
          aria-label={label}
          name={name}
          type="number"
          step="0.5"
          min={min}
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          className="control-raised min-h-9 w-14 border-y bg-transparent px-1 text-center text-xs font-black"
          required
        />
        <button
          type="button"
          aria-label={`Raise ${label}`}
          onClick={() => update(0.5)}
          className="control-raised w-7 rounded-r border text-base"
        >
          +
        </button>
      </span>
    </label>
  );
}

export function LineEditor({
  lineId,
  weekId,
  awaySpread,
  total,
  children,
}: {
  lineId: number;
  weekId: number;
  awaySpread: number;
  total: number;
  children: ReactNode;
}) {
  return (
    <form
      action={saveLine}
      className="game-card grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-end gap-1.5 rounded-lg border p-2"
    >
      <input type="hidden" name="line_id" value={lineId} />
      <input type="hidden" name="week_id" value={weekId} />
      {children}
      <Stepper label="Spread" name="away_spread" initial={awaySpread} />
      <Stepper label="Total" name="total" initial={total} min={1} />
      <button className="control-raised min-h-9 rounded border px-2 text-[9px] font-black">
        SAVE
      </button>
    </form>
  );
}
