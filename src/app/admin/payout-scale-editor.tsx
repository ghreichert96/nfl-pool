"use client";

import { useMemo, useState } from "react";

import {
  generatePayoutScale,
  payoutMaximumRange,
} from "@/features/competition/payout-scale";
import { savePayoutScale } from "./actions";

function money(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}$${Math.abs(value)}`;
}

export function PayoutScaleEditor({
  seasonId,
  entryCount,
  currentMaximum,
}: {
  seasonId: number;
  entryCount: number;
  currentMaximum: number;
}) {
  const range = payoutMaximumRange(entryCount);
  const [maximum, setMaximum] = useState(
    Math.min(range.max, Math.max(range.min, currentMaximum || range.max)),
  );
  const scale = useMemo(() => {
    try {
      return generatePayoutScale(entryCount, maximum);
    } catch {
      return null;
    }
  }, [entryCount, maximum]);

  return (
    <form action={savePayoutScale} className="mt-4">
      <input type="hidden" name="season_id" value={seasonId} />
      <label className="block text-xs font-black">
        Maximum gain / loss
        <span className="mt-1 flex items-center gap-2">
          <span className="text-base">±$</span>
          <input
            name="maximum"
            type="number"
            step="25"
            min={range.min}
            max={range.max}
            value={maximum}
            onChange={(event) => setMaximum(Number(event.target.value))}
            className="control-raised min-h-10 w-28 rounded border px-2 text-right text-sm"
          />
        </span>
      </label>
      <p className="mt-2 text-[10px] text-slate-400">
        {entryCount} competitive entries · ${range.min}–${range.max} · $25
        increments
      </p>
      {scale ? (
        <div className="mt-4 grid grid-cols-4 gap-1 sm:grid-cols-8">
          {scale.map((row) => (
            <div
              key={row.rank}
              className="rounded border border-slate-800 bg-slate-950 px-1 py-2 text-center"
            >
              <small className="block text-[8px] text-slate-500">
                {row.rank}
              </small>
              <strong className="text-[10px]">{money(row.amount)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded bg-red-950 p-2 text-xs text-red-300">
          Enter a valid $25 increment within the allowed range.
        </p>
      )}
      <button
        disabled={!scale}
        className="control-pressed mt-4 min-h-10 w-full rounded border px-4 text-xs font-black disabled:opacity-40"
      >
        SAVE PAYOUT SCALE
      </button>
    </form>
  );
}
