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
  payouts: {
    label: string;
    rank: number;
    amount: number;
  }[];
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
      onClick={(event) => {
        event.stopPropagation();
        open(entryId, event.currentTarget);
      }}
      aria-label={`Performance details for ${children}`}
    >
      {children}
    </button>
  );
}
export function EntryDetailRow({
  entryId,
  name,
  children,
  className = "",
}: {
  entryId: number;
  name: string;
  children: ReactNode;
  className?: string;
}) {
  const open = useContext(DetailContext);
  return (
    <tr
      tabIndex={0}
      aria-label={`Performance details for ${name}`}
      className={`entry-detail-row cursor-pointer focus-visible:outline-2 focus-visible:outline-cyan-300 ${className}`}
      onClick={(event) => open(entryId, event.currentTarget)}
      onKeyDown={(event) => {
        if (
          event.target === event.currentTarget &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          open(entryId, event.currentTarget);
        }
      }}
    >
      {children}
    </tr>
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
  const [mode, setMode] = useState<"overall" | "standings" | "weekly">(
    "overall",
  );
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
  const chartHeight = 230,
    pad = 25;
  const points = entry?.history ?? [];
  const chartWidth = Math.max(420, pad * 2 + (points.length - 1) * 48);
  const maxRank = Math.max(entries.length, 2);
  const referenceRanks = [...new Set([1, Math.min(8, maxRank), maxRank])];
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
          ?.animate?.(
            [
              { backgroundColor: "#38bdf840" },
              { backgroundColor: "transparent" },
            ],
            { duration: 500 },
          );
        setSelected(id);
        setMode("overall");
      }}
    >
      {children}
      {entry &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 backdrop-blur-md sm:p-6"
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
              className="performance-dialog relative max-h-[92dvh] w-full max-w-4xl overflow-auto rounded-2xl border p-3 shadow-2xl outline-none sm:p-4"
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
              <button
                type="button"
                className="absolute right-2 top-2 grid size-7 place-items-center rounded text-xl"
                aria-label="Close performance details"
                onClick={close}
              >
                ×
              </button>
              <div className="relative flex items-center gap-1 pr-7">
                {entry.payouts.map((payout, index) => (
                  <div
                    key={payout.label}
                    className={`flex min-w-0 flex-1 items-center gap-1 ${payout.label === "Total" ? "rounded-md border border-[var(--line)] px-1.5 py-1" : ""}`}
                  >
                    {index > 0 && (
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-[10px] opacity-55"
                      >
                        {payout.label === "Total" ? "=" : "+"}
                      </span>
                    )}
                    <div className="min-w-0 flex-1 text-center">
                      <span className="mb-0.5 flex items-center justify-center gap-1 whitespace-nowrap text-[8px] uppercase sm:text-[10px]">
                        <span className="opacity-70">{payout.label}</span>
                        <span
                          className={`payout-rank rounded px-1 font-black tabular-nums ${payoutRankTone(payout.rank)}`}
                        >
                          {ordinal(payout.rank)}
                        </span>
                      </span>
                      <strong
                        className={`whitespace-nowrap text-xs font-black tabular-nums sm:text-base ${payoutTone(payout.amount)}`}
                      >
                        {payout.amount < 0 ? "−" : payout.amount > 0 ? "+" : ""}
                        ${Math.abs(payout.amount).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-[5.25rem_1fr] gap-1 sm:grid-cols-[6.5rem_1fr] sm:gap-2">
                <div className="grid grid-rows-[1fr_auto_1fr] justify-items-center gap-0.5">
                  <button
                    type="button"
                    className="performance-control performance-carousel-control grid size-6 place-items-center rounded border font-black disabled:opacity-35"
                    aria-label="Previous entry"
                    disabled={index === 0}
                    onClick={() => move(-1)}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="size-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path d="m5 15 7-7 7 7" />
                    </svg>
                  </button>
                  <div className="min-w-0 text-center leading-tight">
                    <strong
                      id="performance-title"
                      className="block break-words text-[11px] font-black sm:text-sm"
                    >
                      {entry.name}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="performance-control performance-carousel-control grid size-6 place-items-center rounded border font-black disabled:opacity-35"
                    aria-label="Next entry"
                    disabled={index === entries.length - 1}
                    onClick={() => move(1)}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="size-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path d="m5 9 7 7 7-7" />
                    </svg>
                  </button>
                </div>
                <div className="min-w-0">
                  <div
                    className="grid grid-cols-3 gap-1 sm:gap-2"
                    role="group"
                    aria-label="Performance chart mode"
                  >
                    {(["overall", "standings", "weekly"] as const).map(
                      (value) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={mode === value}
                          className={`performance-control min-h-8 rounded-md border px-1 py-1 text-[9px] font-bold leading-tight sm:text-xs ${mode === value ? "performance-control-selected" : ""}`}
                          onClick={() => setMode(value)}
                        >
                          {value === "overall"
                            ? "Payout Rank"
                            : value === "standings"
                              ? "Main Pool Standing"
                              : "Main Finish by Week"}
                        </button>
                      ),
                    )}
                  </div>
                  {points.length ? (
                    <div
                      role="region"
                      aria-label="Scrollable performance chart"
                      tabIndex={0}
                      className="mt-1 min-w-0 overflow-x-auto"
                    >
                      <svg
                        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                        role="img"
                        aria-label={`${entry.name} ${mode === "overall" ? "payout rank" : mode === "standings" ? "main pool standing" : "main finish"} by week`}
                        className="block max-w-none overflow-visible"
                        style={{ width: chartWidth }}
                      >
                        {referenceRanks.map((rank) => (
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
                    </div>
                  ) : (
                    <p className="mt-4 text-xs opacity-70">
                      Available after the first kickoff.
                    </p>
                  )}
                  <p className="mt-2 text-[10px] opacity-70">
                    Week
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

function payoutTone(amount: number) {
  return amount > 0
    ? "payout-positive"
    : amount < 0
      ? "payout-negative"
      : "payout-neutral";
}

function payoutRankTone(rank: number) {
  return rank === 1
    ? "payout-rank-first"
    : rank <= 3
      ? "payout-rank-top-three"
      : rank <= 6
        ? "payout-rank-top-six"
        : "payout-rank-other";
}

function ordinal(rank: number) {
  const remainder100 = rank % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}
