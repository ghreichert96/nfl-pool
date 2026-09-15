"use client";

import type { ReactNode, UIEvent } from "react";
import { useLayoutEffect, useRef } from "react";

export function StickyTableHeader({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const scroller = scrollerRef.current;
    const overlay = overlayRef.current;
    const table = scroller?.querySelector("table");
    const sourceHead = table?.tHead;
    if (!root || !scroller || !overlay || !table || !sourceHead) return;

    const updateVisibility = () => {
      const stickyTop = window.matchMedia("(min-width: 640px)").matches
        ? 101
        : 93;
      const headRect = sourceHead.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      overlay.style.visibility =
        headRect.top < stickyTop &&
        tableRect.bottom > stickyTop + headRect.height
          ? "visible"
          : "hidden";
    };

    const renderOverlay = () => {
      const sourceCells = sourceHead.rows[0]?.cells;
      if (!sourceCells?.length) return;
      const widths = Array.from(
        sourceCells,
        (cell) => Math.round(cell.getBoundingClientRect().width * 100) / 100,
      );
      const clone = table.cloneNode(false) as HTMLTableElement;
      clone.removeAttribute("id");
      clone.style.width = `${table.scrollWidth}px`;
      clone.style.minWidth = `${table.scrollWidth}px`;
      clone.style.transform = `translateX(-${scroller.scrollLeft}px)`;
      const colgroup = document.createElement("colgroup");
      widths.forEach((width) => {
        const col = document.createElement("col");
        col.style.width = `${width}px`;
        colgroup.append(col);
      });
      const clonedHead = sourceHead.cloneNode(true) as HTMLTableSectionElement;
      clonedHead.classList.remove("sticky", "top-0");
      clone.append(colgroup, clonedHead);
      overlay.replaceChildren(clone);
      updateVisibility();
    };

    renderOverlay();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    if (typeof ResizeObserver === "undefined")
      return () => window.removeEventListener("scroll", updateVisibility);
    const observer = new ResizeObserver(() => {
      renderOverlay();
      updateVisibility();
    });
    observer.observe(table);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateVisibility);
    };
  }, [children]);

  const syncHeader = (event: UIEvent<HTMLDivElement>) => {
    const table = overlayRef.current?.querySelector("table");
    if (table)
      table.style.transform = `translateX(-${event.currentTarget.scrollLeft}px)`;
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="pointer-events-none sticky top-[93px] z-40 h-0 overflow-visible sm:top-[101px]">
        <div
          ref={overlayRef}
          className="invisible overflow-hidden bg-slate-950"
        />
      </div>
      <div ref={scrollerRef} className="overflow-x-auto" onScroll={syncHeader}>
        {children}
      </div>
    </div>
  );
}
