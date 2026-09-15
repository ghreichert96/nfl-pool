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

function HeaderRow() {
  return (
    <tr>
      {headers.map((label, index) => (
        <th
          key={label}
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
  const syncHeader = (event: UIEvent<HTMLDivElement>) => {
    if (headerRef.current)
      headerRef.current.style.transform = `translateX(-${event.currentTarget.scrollLeft}px)`;
  };

  return (
    <div>
      <div className="sticky top-[93px] z-20 overflow-hidden bg-slate-950 sm:top-[101px]">
        <table
          ref={headerRef}
          className="w-full min-w-[720px] border-separate border-spacing-0 text-[11px]"
        >
          <thead>
            <HeaderRow />
          </thead>
        </table>
        <div className="absolute inset-y-0 left-0 grid w-[52px] place-items-center border-r border-b border-slate-800 bg-slate-950 text-[10px] font-black text-slate-100">
          TM
        </div>
      </div>
      <div className="overflow-x-auto overscroll-y-auto" onScroll={syncHeader}>
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[11px]">
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
