"use client";

import type { ReactNode } from "react";
import { useState } from "react";

export function CollapsiblePanel({
  title,
  summary,
  preview,
  children,
  defaultOpen = false,
  className = "",
}: {
  title: string;
  summary?: ReactNode;
  preview?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={`game-card overflow-clip rounded-xl border ${className}`}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2 px-3 py-3 text-left text-xs font-black uppercase"
      >
        <span>{title}</span>
        {summary && (
          <span className="min-w-0 flex-1 truncate text-[10px] font-normal text-slate-500">
            {summary}
          </span>
        )}
        <span aria-hidden="true" className="ml-auto text-slate-400">
          {open ? "⌃" : "⌄"}
        </span>
      </button>
      {open ? children : preview}
    </section>
  );
}
