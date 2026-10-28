"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshIcon, UpdateStatus } from "@/components/update-status";
import type { Freshness } from "@/lib/scores/freshness";
import { saveScores, refreshScores } from "./actions";
import { releaseGameResultToProvider } from "../actions";

export type ScoreRow = {
  game_id: number;
  away: string;
  home: string;
  game_type: string;
  status: string;
  away_score: number | null;
  home_score: number | null;
  updated_at: string;
  source: string | null;
};
export function ScoresTable({
  rows,
  weekId,
  weekNumber,
  weeks,
  freshness,
}: {
  rows: ScoreRow[];
  weekId: number;
  weekNumber: number;
  weeks: { id: number; week_number: number; label: string }[];
  freshness?: Freshness;
}) {
  const router = useRouter();
  const [base, setBase] = useState(rows);
  const [draft, setDraft] = useState(rows);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const changed = draft.filter(
    (r, i) =>
      r.away_score !== base[i]?.away_score ||
      r.home_score !== base[i]?.home_score,
  );
  const dirty = changed.length > 0;
  // Server polling can update a clean table, but never replace unsaved edits.
  if (rows !== base && !dirty) {
    setBase(rows);
    setDraft(rows);
  }
  const guard = () => !dirty || confirm("Discard unsaved score edits?");
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => e.preventDefault();
    const navigate = (e: Event) => {
      if (
        (e.type === "hppp-before-navigation" ||
          (e.target as Element).closest?.("a[href]")) &&
        !confirm("Discard unsaved score edits?")
      )
        e.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("hppp-before-navigation", navigate);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("hppp-before-navigation", navigate);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  const edit = (
    id: number,
    field: "away_score" | "home_score",
    value: number | null,
  ) =>
    setDraft((current) =>
      current.map((r) => (r.game_id === id ? { ...r, [field]: value } : r)),
    );
  const control = (r: ScoreRow, field: "away_score" | "home_score") => (
    <div className="grid justify-items-center">
      <button
        type="button"
        aria-label={`Increase ${field === "away_score" ? r.away : r.home} score`}
        onClick={() =>
          edit(r.game_id, field, Math.min(255, (r[field] ?? 0) + 1))
        }
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
        aria-label={`${r.away} at ${r.home} ${field === "away_score" ? "away" : "home"} score`}
        type="number"
        min="0"
        max="255"
        step="1"
        value={r[field] ?? ""}
        onChange={(e) =>
          edit(
            r.game_id,
            field,
            e.target.value === "" ? null : Number(e.target.value),
          )
        }
        className="w-14 rounded border border-[var(--line)] bg-transparent px-1 text-center"
      />
      <button
        type="button"
        aria-label={`Decrease ${field === "away_score" ? r.away : r.home} score`}
        onClick={() => edit(r.game_id, field, Math.max(0, (r[field] ?? 0) - 1))}
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
  return (
    <div>
      <div className="sticky top-[49px] z-20 flex flex-wrap items-center gap-2 bg-[var(--panel)] py-2 sm:top-[57px]">
        <select
          aria-label="Week"
          value={weekNumber}
          className="control-raised h-9 rounded border px-2"
          onChange={(e) => {
            if (guard()) router.push(`/admin/scores?week=${e.target.value}`);
          }}
        >
          {weeks.map((w) => (
            <option key={w.id} value={w.week_number}>
              {w.label}
            </option>
          ))}
        </select>
        <button
          aria-label="Refresh scores from ESPN"
          title="Refresh scores from ESPN"
          disabled={pending}
          className="admin-button flex items-center justify-center"
          onClick={() => {
            if (!guard()) return;
            start(async () => {
              try {
                const result = await refreshScores(weekId);
                setMessage(result.message);
                if (result.ok) {
                  setDraft(base);
                  router.refresh();
                }
              } catch {
                setMessage("ESPN refresh failed. Edits retained.");
              }
            });
          }}
        >
          <RefreshIcon />
        </button>
        <button
          disabled={!dirty || pending}
          className="admin-button submit-ready"
          onClick={() =>
            start(async () => {
              try {
                const result = await saveScores(
                  weekId,
                  changed.map((r) => ({
                    game_id: r.game_id,
                    updated_at: r.updated_at,
                    away_score: r.away_score,
                    home_score: r.home_score,
                  })),
                );
                setMessage(result.message);
                if (result.ok) {
                  setDraft(base);
                  router.refresh();
                }
              } catch {
                setMessage("Could not save scores. Edits retained.");
              }
            })
          }
        >
          {pending
            ? "Working…"
            : dirty
              ? `Save finals (${changed.length})`
              : "Saved"}
        </button>
        <UpdateStatus freshness={freshness} />
      </div>
      {message && (
        <p role="status" className="py-1 text-xs">
          {message}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="pool-table w-full text-center text-xs">
          <thead>
            <tr>
              {["Type", "Away", "Score", "Home", "Score", "Status"].map(
                (label, i) => (
                  <th key={i} className="border-b border-[var(--line)] py-2">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {draft.map((r) => (
              <tr key={r.game_id} className="border-b border-[var(--line)]">
                <td className="text-[10px] font-bold">
                  {{
                    international: "INT",
                    tnf: "TNF",
                    snf: "SNF",
                    mnf: "MNF",
                    sunday: "SUN",
                  }[r.game_type] ?? "SPE"}
                </td>
                <th>{r.away}</th>
                <td>{control(r, "away_score")}</td>
                <th>{r.home}</th>
                <td>{control(r, "home_score")}</td>
                <td className="text-[9px] capitalize">
                  {r.status}
                  {r.source === "commissioner" && (
                    <details>
                      <summary className="cursor-pointer">Edited</summary>
                      <form
                        action={releaseGameResultToProvider}
                        onSubmit={(e) => {
                          if (!guard()) e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="game_id" value={r.game_id} />
                        <input type="hidden" name="week" value={weekNumber} />
                        <button className="mt-1 underline">Use ESPN</button>
                      </form>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
