"use client";

import type { ReactNode, UIEvent } from "react";
import { useLayoutEffect, useRef, useState } from "react";

const headers = [
  "TM",
  "BB",
  "1",
  "2",
  "3",
  "4",
  "5",
  "OU1",
  "OU2",
  "OU3",
  "UD",
  "SD",
  "Comment",
];

function HeaderRow({ widths }: { widths?: number[] }) {
  return (
    <tr>
      {headers.map((label, index) => (
        <th
          key={label}
          style={widths?.[index] ? { width: widths[index] } : undefined}
          className={`border-b border-r border-slate-800 px-1 py-2 text-left text-[10px] font-black uppercase text-slate-100 ${index === 0 ? "w-[52px] min-w-[52px] max-w-[52px] bg-slate-950" : ""}`}
        >
          {label}
        </th>
      ))}
    </tr>
  );
}

export function GridPreviewTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto border-t border-slate-800">
      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[11px]">
        <thead className="bg-slate-950">
          <HeaderRow />
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function StickyGridTable({ children }: { children: ReactNode }) {
  const headerRef = useRef<HTMLTableElement>(null);
  const bodyRef = useRef<HTMLTableElement>(null);
  const [widths, setWidths] = useState<number[]>([]);
  const [tableWidth, setTableWidth] = useState(720);

  useLayoutEffect(() => {
    const table = bodyRef.current;
    if (!table) return;
    const measure = () => {
      const cells = table.tBodies[0]?.rows[0]?.cells;
      if (!cells?.length) return;
      const nextWidths = Array.from(
        cells,
        (cell) => Math.round(cell.getBoundingClientRect().width * 100) / 100,
      );
      const nextTableWidth = Math.max(
        720,
        Math.round(nextWidths.reduce((sum, width) => sum + width, 0) * 100) /
          100,
      );
      setWidths((current) =>
        current.length === nextWidths.length &&
        current.every((width, index) => width === nextWidths[index])
          ? current
          : nextWidths,
      );
      setTableWidth((current) =>
        current === nextTableWidth ? current : nextTableWidth,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(table);
    return () => observer.disconnect();
  }, [children]);

  const syncHeader = (event: UIEvent<HTMLDivElement>) => {
    if (headerRef.current)
      headerRef.current.style.transform = `translateX(-${event.currentTarget.scrollLeft}px)`;
  };

  return (
    <div>
      <div className="sticky top-[93px] z-20 overflow-hidden bg-slate-950 sm:top-[101px]">
        <table
          ref={headerRef}
          className="table-fixed border-separate border-spacing-0 text-[11px]"
          style={{ width: tableWidth }}
        >
          {widths.length > 0 && (
            <colgroup>
              {widths.map((width, index) => (
                <col key={headers[index]} style={{ width }} />
              ))}
            </colgroup>
          )}
          <thead>
            <HeaderRow widths={widths} />
          </thead>
        </table>
        <div
          className="absolute inset-y-0 left-0 flex items-center border-r border-b border-slate-800 bg-slate-950 px-2 text-left text-[10px] font-black text-slate-100"
          style={{ width: widths[0] ?? 52 }}
        >
          TM
        </div>
      </div>
      <div className="overflow-x-auto overscroll-y-auto" onScroll={syncHeader}>
        <table
          ref={bodyRef}
          className="w-full min-w-[720px] border-separate border-spacing-0 text-[11px]"
        >
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
