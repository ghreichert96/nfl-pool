"use client";

import type { ReactNode, UIEvent } from "react";
import { useRef } from "react";

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
const columnWidths = [52, 42, 42, 42, 42, 42, 42, 50, 50, 50, 48, 48, 170];
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
          className={`border-b border-r border-slate-800 py-2 text-left text-[10px] font-black uppercase text-slate-100 ${index === 0 ? "w-[52px] min-w-[52px] max-w-[52px] bg-slate-950 px-2" : "px-1"}`}
        >
          {label}
        </th>
      ))}
    </tr>
  );
}

export function GridPreviewTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto border-t border-slate-600">
      <table
        className="table-fixed border-separate border-spacing-0 text-[11px]"
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
          <GridColumns />
          <thead>
            <HeaderRow />
          </thead>
        </table>
        <div
          className="absolute inset-y-0 left-0 flex items-center border-r border-b border-slate-800 bg-slate-950 px-2 text-left text-[10px] font-black text-slate-100"
          style={{ width: columnWidths[0] }}
        >
          TM
        </div>
      </div>
      <div className="overflow-x-auto overscroll-y-auto" onScroll={syncHeader}>
        <table
          className="table-fixed border-separate border-spacing-0 text-[11px]"
          style={{ width: tableWidth }}
        >
          <GridColumns />
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
