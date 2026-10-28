"use client";
import { RefreshIcon, UpdateStatus } from "@/components/update-status";
import type { Freshness } from "@/lib/scores/freshness";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  initializeUpcomingLines,
  refreshLines,
  saveLinesBatch,
  toggleLinesFreeze,
} from "./actions";
export type EditableLine = {
  game_id: number;
  updated_at: string | null;
  away_spread: number;
  total: number;
  spread_override: boolean;
  total_override: boolean;
  game_type: string;
  away: string;
  home: string;
  status: string;
  odds_refresh_error?: string | null;
  spread_book: string | null;
  total_book: string | null;
  spread_observed_at: string | null;
  total_observed_at: string | null;
};
export function LinesTable({
  weekId,
  weekNumber,
  weeks,
  frozen,
  rows,
  freshness,
}: {
  weekId: number;
  weekNumber: number;
  weeks: { id: number; week_number: number; label: string }[];
  frozen: boolean;
  rows: EditableLine[];
  freshness?: Freshness;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(rows);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const changed = draft.filter(
    (r, i) => JSON.stringify(r) !== JSON.stringify(rows[i]),
  );
  const dirty = changed.length > 0;
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    const navigate = (e: MouseEvent) => {
      if (
        dirty &&
        (e.target as Element).closest("a[href]") &&
        !confirm("Discard unsaved line edits?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const beforeNavigation = (event: Event) => {
      if (dirty && !confirm("Discard unsaved line edits?"))
        event.preventDefault();
    };
    window.addEventListener("hppp-before-navigation", beforeNavigation);
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("hppp-before-navigation", beforeNavigation);
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  const edit = (i: number, patch: Partial<EditableLine>) =>
    setDraft((current) =>
      current.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    );
  const guard = () =>
    !dirty || confirm("Discard unsaved edits before this action?");
  const numeric = (
    r: EditableLine,
    i: number,
    field: "away_spread" | "total",
  ) => {
    const override = field === "total" ? "total_override" : "spread_override";
    const valid =
      Number.isFinite(r[field]) &&
      (r[field] * 2) % 1 === 0 &&
      (field === "total"
        ? r[field] > 0 && r[field] <= 999
        : Math.abs(r[field]) <= 99);
    return (
      <div className="grid justify-items-center">
        <button
          type="button"
          aria-label={`Increase ${field} ${r.away}`}
          onClick={() => edit(i, { [field]: r[field] + 0.5, [override]: true })}
          className="flex h-6 w-full items-center justify-center"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="currentColor"
          >
            <path d="M3 10l5-5 5 5Z" />
          </svg>
        </button>
        <input
          aria-label={`${r.away} ${field}`}
          aria-invalid={!valid}
          type="number"
          step="0.5"
          value={Number.isNaN(r[field]) ? "" : r[field]}
          onChange={(e) =>
            edit(i, {
              [field]: e.target.value === "" ? NaN : Number(e.target.value),
              [override]: true,
            })
          }
          className="w-16 rounded border border-[var(--line)] bg-transparent px-1 text-center aria-invalid:border-red-400"
        />
        <button
          type="button"
          aria-label={`Decrease ${field} ${r.away}`}
          onClick={() => edit(i, { [field]: r[field] - 0.5, [override]: true })}
          className="flex h-6 w-full items-center justify-center"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="currentColor"
          >
            <path d="M3 6l5 5 5-5Z" />
          </svg>
        </button>
      </div>
    );
  };
  return (
    <div>
      <div className="sticky top-[49px] z-20 flex flex-wrap items-center gap-2 bg-[var(--panel)] py-2 sm:top-[57px]">
        <select
          aria-label="Week"
          className="control-raised h-9 rounded border px-2"
          value={weekNumber}
          onChange={(e) => {
            if (guard()) router.push(`/admin/lines?week=${e.target.value}`);
          }}
        >
          {weeks.map((w) => (
            <option key={w.id} value={w.week_number}>
              {w.label}
            </option>
          ))}
        </select>
        <form
          action={initializeUpcomingLines}
          onSubmit={(e) => {
            if (!guard()) e.preventDefault();
          }}
        >
          <button className="admin-button">Initialize</button>
        </form>
        <form
          action={refreshLines}
          onSubmit={(e) => {
            if (!guard()) e.preventDefault();
          }}
        >
          <input type="hidden" name="week_id" value={weekId} />
          <button
            disabled={frozen}
            aria-label="Refresh lines"
            title="Refresh lines"
            className="admin-button flex items-center justify-center"
          >
            <RefreshIcon />
          </button>
        </form>
        <form
          action={toggleLinesFreeze}
          onSubmit={(e) => {
            if (!guard()) e.preventDefault();
          }}
        >
          <input type="hidden" name="week_id" value={weekId} />
          <input type="hidden" name="freeze" value={frozen ? "0" : "1"} />
          <button className="admin-button">{frozen ? "Unlock" : "Lock"}</button>
        </form>
        <button
          disabled={!dirty || pending}
          className="admin-button submit-ready"
          onClick={() =>
            start(async () => {
              try {
                const result = await saveLinesBatch(weekId, changed);
                setMessage(result.message);
                if (result.ok) router.refresh();
              } catch {
                setMessage(
                  "Could not save. Your edits are retained; try again.",
                );
              }
            })
          }
        >
          {pending ? "Saving…" : dirty ? `Save (${changed.length})` : "Saved"}
        </button>
        <UpdateStatus freshness={freshness} />
      </div>
      <p role="status" className="py-1 text-xs">
        {message}
      </p>
      <div className="overflow-x-auto">
        <table className="pool-table w-full text-center text-xs">
          <thead>
            <tr>
              {["Type", "Away", "Spread", "Home", "Total", "Status"].map(
                (h) => (
                  <th key={h} className="border-b border-[var(--line)] py-2">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {draft.map((r, i) => (
              <tr key={r.game_id} className="border-b border-[var(--line)]">
                <td>
                  <select
                    aria-label={`${r.away} game type`}
                    value={r.game_type}
                    onChange={(e) => edit(i, { game_type: e.target.value })}
                    className="w-16 bg-[var(--panel)] text-xs"
                  >
                    {[
                      ["sunday", "SUN"],
                      ["tnf", "TNF"],
                      ["snf", "SNF"],
                      ["mnf", "MNF"],
                      ["international", "INT"],
                      ["special", "SPE"],
                    ].map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </td>
                <th>{r.away}</th>
                <td>{numeric(r, i, "away_spread")}</td>
                <th>{r.home}</th>
                <td>{numeric(r, i, "total")}</td>
                <td className="max-w-24 text-[9px]">
                  <div>{frozen ? "Locked" : r.status}</div>
                  {r.odds_refresh_error && (
                    <p
                      role="alert"
                      className="mt-1 max-w-40 text-[10px] normal-case text-amber-400"
                    >
                      {r.odds_refresh_error}
                    </p>
                  )}
                  <details>
                    <summary className="cursor-pointer">Sources</summary>
                    <div>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={!r.spread_override}
                          onChange={(e) =>
                            edit(i, { spread_override: !e.target.checked })
                          }
                        />
                        Automatic spread
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={!r.total_override}
                          onChange={(e) =>
                            edit(i, { total_override: !e.target.checked })
                          }
                        />
                        Automatic total
                      </label>
                      Spread: {r.spread_book ?? "—"}
                      <br />
                      {r.spread_observed_at
                        ? new Date(r.spread_observed_at).toLocaleString()
                        : ""}
                      <br />
                      Total: {r.total_book ?? "—"}
                      <br />
                      {r.total_observed_at
                        ? new Date(r.total_observed_at).toLocaleString()
                        : ""}
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
