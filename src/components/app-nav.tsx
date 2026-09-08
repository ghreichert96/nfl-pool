"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const primary = [
  { href: "/", label: "Picks" },
  { href: "/grid", label: "Grid" },
  { href: "/standings", label: "Standings" },
  { href: "/rules", label: "Rules" },
];

export function AppNav({
  entryCode,
  isCommissioner = false,
}: {
  entryCode?: string;
  isCommissioner?: boolean;
}) {
  const pathname = usePathname();

  return (
    <header className="app-header sticky top-0 z-40 border-b border-slate-700 bg-[#07090b]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2 sm:px-5">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2"
          aria-label="HPPP home"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-md border border-slate-500 bg-slate-200 text-[10px] font-black tracking-tighter text-slate-950 shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)]">
            HPPP
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-xs font-black uppercase tracking-[0.16em]">
              NFL Pool
            </strong>
            <small className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
              2026{entryCode ? ` · ${entryCode}` : ""}
            </small>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
          {primary.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md border px-3 py-2 text-[11px] font-black uppercase tracking-wide ${active ? "control-pressed" : "control-raised text-slate-300"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          {isCommissioner && (
            <Link
              href="/admin"
              aria-label="Commissioner admin"
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              className={`grid size-9 place-items-center rounded-md border ${pathname.startsWith("/admin") ? "control-pressed" : "control-raised"}`}
            >
              <span aria-hidden="true" className="text-sm">
                ⚙
              </span>
            </Link>
          )}
          <Link
            href="/account"
            aria-label="Profile"
            aria-current={pathname.startsWith("/account") ? "page" : undefined}
            className={`grid size-9 place-items-center rounded-md border ${pathname.startsWith("/account") ? "control-pressed" : "control-raised"}`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="8" r="3.25" />
              <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
            </svg>
          </Link>
        </div>
      </div>

      <nav
        aria-label="Mobile primary"
        className="grid grid-cols-4 border-t border-slate-800 sm:hidden"
      >
        {primary.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`grid min-h-10 place-items-center border-r border-slate-800 text-[9px] font-black uppercase tracking-wide last:border-r-0 ${active ? "bg-slate-100 text-slate-950" : "bg-slate-950 text-slate-400"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
