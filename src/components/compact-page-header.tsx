import type { ReactNode } from "react";

export function CompactPageHeader({
  title,
  action,
  sticky = false,
  className = "",
}: {
  title: ReactNode;
  action?: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`${sticky ? "sticky top-[49px] z-30 sm:top-[57px]" : ""} flex min-h-11 items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 shadow-sm ${className}`}
    >
      <h1 className="min-w-0 text-xs font-black uppercase tracking-wide text-inherit">
        {title}
      </h1>
      {action}
    </div>
  );
}
