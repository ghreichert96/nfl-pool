"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { PerformancePoint } from "@/features/competition/performance";
export type EntryPerformance = {
  id: number;
  name: string;
  history: PerformancePoint[];
  payouts: { label: string; amount: number; explanation: string }[];
};
const DetailContext = createContext<(id: number, opener: HTMLElement) => void>(
  () => {},
);
export function EntryDetailButton({
  entryId,
  children,
}: {
  entryId: number;
  children: ReactNode;
}) {
  const open = useContext(DetailContext);
  return (
    <button
      type="button"
      className="entry-detail-trigger rounded py-1 text-left font-inherit active:bg-cyan-400/20"
      onClick={(event) => open(entryId, event.currentTarget)}
      aria-label={`Performance details for ${children}`}
    >
      {children}
    </button>
  );
}
export function EntryPerformanceProvider({
  entries,
  children,
}: {
  entries: EntryPerformance[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<"standings" | "weekly">("standings");
  const opener = useRef<HTMLElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const isOpen = selected !== null;
  const dialog = useRef<HTMLDivElement>(null);
  const index = entries.findIndex((entry) => entry.id === selected);
  const entry = entries[index];
  const close = () => setSelected(null);
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = original;
      opener.current?.focus({ preventScroll: true });
    };
  }, [isOpen]);
  const move = (delta: number) =>
    setSelected(
      entries[Math.max(0, Math.min(entries.length - 1, index + delta))].id,
    );
  const chartWidth = 420,
    chartHeight = 180,
    pad = 25;
  const points = entry?.history ?? [];
  const maxRank = Math.max(entries.length, 2);
  const x = (i: number) =>
    pad +
    (points.length === 1 ? 0.5 : i / Math.max(1, points.length - 1)) *
      (chartWidth - pad * 2);
  const y = (rank: number) =>
    pad + ((rank - 1) / (maxRank - 1)) * (chartHeight - pad * 2);
  return (
    <DetailContext.Provider
      value={(id, element) => {
        opener.current = element;
        setPortalTarget(element.closest(".pick-shell"));
        element
          .closest("tr")
          ?.animate(
            [
              { backgroundColor: "#38bdf840" },
              { backgroundColor: "transparent" },
            ],
            { duration: 500 },
          );
        setSelected(id);
        setMode("standings");
      }}
    >
      {children}
      {entry &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-2 sm:p-6"
            onClick={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <div
              ref={dialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="performance-title"
              tabIndex={-1}
              className="performance-dialog max-h-[90dvh] w-full max-w-2xl overflow-auto rounded-xl border p-3 shadow-2xl outline-none"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                }
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  event.preventDefault();
                  move(event.key === "ArrowUp" ? -1 : 1);
                }
                if (event.key === "Tab") {
                  const buttons = Array.from(
                    dialog.current?.querySelectorAll<HTMLElement>(
                      'button:not(:disabled),summary,[tabindex="0"]',
                    ) ?? [],
                  );
                  const first = buttons[0],
                    last = buttons.at(-1);
                  if (
                    event.shiftKey &&
                    (document.activeElement === first ||
                      document.activeElement === dialog.current)
                  ) {
                    event.preventDefault();
                    last?.focus();
                  } else if (
                    !event.shiftKey &&
                    document.activeElement === last
                  ) {
                    event.preventDefault();
                    first?.focus();
                  }
                }
              }}
            >
              <div className="grid grid-cols-[4rem_1fr] gap-3">
                <div className="sticky top-0 flex h-fit flex-col items-start gap-2">
                  <button
                    type="button"
                    className="admin-button w-full"
                    aria-label="Previous entry"
                    disabled={index === 0}
                    onClick={() => move(-1)}
                  >
                    ↑
                  </button>
                  <strong id="performance-title" className="text-sm">
                    {entry.name}
                  </strong>
                  <button
                    type="button"
                    className="admin-button w-full"
                    aria-label="Next entry"
                    disabled={index === entries.length - 1}
                    onClick={() => move(1)}
                  >
                    ↓
                  </button>
                </div>
                <div className="min-w-0">
                  <div className="mb-3 flex justify-end">
                    <button
                      type="button"
                      className="rounded px-2 text-xl"
                      aria-label="Close performance details"
                      onClick={close}
                    >
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {entry.payouts.map((payout) => (
                      <details
                        key={payout.label}
                        className="rounded-lg border border-[var(--line)] p-2"
                      >
                        <summary className="cursor-pointer list-none">
                          <span className="block text-[10px] uppercase opacity-70">
                            {payout.label}
                          </span>
                          <strong className="text-sm">
                            {payout.amount < 0
                              ? "−"
                              : payout.amount > 0
                                ? "+"
                                : ""}
                            ${Math.abs(payout.amount).toFixed(2)}
                          </strong>
                        </summary>
                        <p className="mt-2 text-[11px] leading-relaxed">
                          {payout.explanation}
                        </p>
                      </details>
                    ))}
                  </div>
                  <h2 className="mt-5 text-sm font-black">
                    Main pool performance
                  </h2>
                  <div
                    className="mt-2 flex gap-1"
                    role="group"
                    aria-label="Performance chart mode"
                  >
                    {(["standings", "weekly"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={mode === value}
                        className={`admin-button ${mode === value ? "control-pressed" : ""}`}
                        onClick={() => setMode(value)}
                      >
                        {value === "standings" ? "Standings" : "Weekly rank"}
                      </button>
                    ))}
                  </div>
                  {points.length ? (
                    <svg
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                      role="img"
                      aria-label={`${entry.name} ${mode === "standings" ? "standings" : "weekly rank"} by week, rank one at the top`}
                      className="mt-3 w-full overflow-visible"
                    >
                      {[1, maxRank].map((rank) => (
                        <g key={rank}>
                          <line
                            x1={pad}
                            y1={y(rank)}
                            x2={chartWidth - pad}
                            y2={y(rank)}
                            stroke="currentColor"
                            opacity=".12"
                          />
                          <text
                            x={2}
                            y={y(rank) + 3}
                            fill="currentColor"
                            fontSize="10"
                          >
                            {rank}
                          </text>
                        </g>
                      ))}
                      {points.map((point, i) => {
                        const prior = points[i - 1];
                        const color =
                          !prior || point[mode] === prior[mode]
                            ? "#eab308"
                            : point[mode] < prior[mode]
                              ? "#22c55e"
                              : "#ef4444";
                        return (
                          <g key={point.week}>
                            {prior && (
                              <line
                                x1={x(i - 1)}
                                y1={y(prior[mode])}
                                x2={x(i)}
                                y2={y(point[mode])}
                                stroke={color}
                                strokeWidth="2.5"
                                strokeDasharray={
                                  point.provisional ? "4 3" : undefined
                                }
                              />
                            )}
                            <circle
                              cx={x(i)}
                              cy={y(point[mode])}
                              r="3.5"
                              fill={color}
                            >
                              <title>{`Week ${point.week}: rank ${point[mode]}${point.provisional ? " (provisional)" : ""}`}</title>
                            </circle>
                            <text
                              x={x(i)}
                              y={chartHeight - 4}
                              textAnchor="middle"
                              fill="currentColor"
                              fontSize="9"
                            >
                              {point.week}
                              {point.provisional ? "*" : ""}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  ) : (
                    <p className="mt-4 text-xs opacity-70">
                      Available after the first kickoff.
                    </p>
                  )}
                  <p className="mt-2 text-[10px] opacity-70">
                    Week · Rank 1 is best
                    {points.some((p) => p.provisional)
                      ? " · * provisional"
                      : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>,
          portalTarget ?? document.body,
        )}
    </DetailContext.Provider>
  );
}
