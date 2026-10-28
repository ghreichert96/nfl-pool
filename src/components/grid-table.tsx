"use client";

import type { ReactNode, UIEvent } from "react";
import { useLayoutEffect, useRef } from "react";

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
const columnWidths = [60, 48, 48, 48, 48, 48, 48, 68, 68, 68, 52, 52, 180];
const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);

function GridColumns() {
  return (
    <colgroup>
      {columnWidths.map((width, index) => (
        <col key={headers[index]} style={{ width }} />
      ))}
    </colgroup>
  );
}

function HeaderRow() {
  return (
    <tr>
      {headers.map((label, index) => (
        <th
          key={label}
          style={{ width: columnWidths[index] }}
          className={`border-b border-r border-slate-800 py-2 text-left text-[11px] font-black uppercase text-slate-100 ${index === 0 ? "w-[60px] min-w-[60px] max-w-[60px] bg-slate-950 px-2" : "px-1"}`}
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
      <table
        className="pool-table table-fixed border-separate border-spacing-0 text-xs"
        style={{ width: tableWidth }}
      >
        <GridColumns />
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
  const frameRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const header = document.querySelector("[data-sticky-page-header]");
    if (!header) return;
    const update = () =>
      frameRef.current?.style.setProperty(
        "--table-sticky-top",
        `${parseFloat(getComputedStyle(header).top) + header.getBoundingClientRect().height}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  const syncHeader = (event: UIEvent<HTMLDivElement>) => {
    if (headerRef.current)
      headerRef.current.style.transform = `translateX(-${event.currentTarget.scrollLeft}px)`;
  };
  return (
    <div ref={frameRef}>
      <div className="sticky top-[var(--table-sticky-top,93px)] z-20 overflow-hidden border-t border-slate-800 bg-slate-950 sm:top-[var(--table-sticky-top,101px)]">
        <table
          ref={headerRef}
          className="pool-table table-fixed border-separate border-spacing-0 text-xs"
          style={{ width: tableWidth }}
        >
          <GridColumns />
          <thead>
            <HeaderRow />
          </thead>
        </table>
        <div
          className="absolute inset-y-0 left-0 flex items-center border-r border-b border-slate-800 bg-slate-950 px-2 text-left text-[11px] font-black text-slate-100"
          style={{ width: columnWidths[0] }}
        >
          TM
        </div>
      </div>
      <div className="overflow-x-auto overscroll-y-auto" onScroll={syncHeader}>
        <table
          className="pool-table table-fixed border-separate border-spacing-0 text-xs"
          style={{ width: tableWidth }}
        >
          <GridColumns />
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
