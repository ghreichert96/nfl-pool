"use client";
import { useLayoutEffect, useRef } from "react";
import type { ReactNode, UIEvent } from "react";

export function StickyTableFrame({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const pageHeader = document.querySelector("[data-sticky-page-header]");
    if (!pageHeader) return;
    const updateTop = () => {
      const top =
        parseFloat(getComputedStyle(pageHeader).top) +
        pageHeader.getBoundingClientRect().height;
      rootRef.current?.style.setProperty("--table-sticky-top", `${top}px`);
    };
    updateTop();
    window.addEventListener("resize", updateTop);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateTop);
    observer?.observe(pageHeader);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateTop);
    };
  }, []);

  const syncHeader = (event: UIEvent<HTMLDivElement>) => {
    if (headerRef.current)
      headerRef.current.scrollLeft = event.currentTarget.scrollLeft;
  };

  return (
    <div ref={rootRef}>
      <div
        ref={headerRef}
        aria-hidden="true"
        className="sticky top-[var(--table-sticky-top,93px)] z-20 overflow-hidden bg-slate-950 sm:top-[var(--table-sticky-top,101px)]"
      >
        {header}
      </div>
      <div className="overflow-x-auto" onScroll={syncHeader}>
        {children}
      </div>
    </div>
  );
}
