"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const primary = [
  { href: "/", label: "Picks", icon: "check" },
  { href: "/grid", label: "Grid", icon: "football" },
  { href: "/standings", label: "Standings", icon: "table" },
] as const;
type IconName = "check" | "football" | "table" | "menu";
function Icon({ name }: { name: IconName }) {
  if (name === "check")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </svg>
    );
  if (name === "football")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4.5 19.5c-2-2-1-7 2.5-10.5s8.5-4.5 10.5-2.5 1 7-2.5 10.5-8.5 4.5-10.5 2.5Z" />
        <path d="m8 16 8-8M10 11l3 3m-1-5 3 3" />
      </svg>
    );
  if (name === "table")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="5" width="18" height="14" rx="1" />
        <path d="M3 10h18M9 5v14" />
      </svg>
    );
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function AppNav({
  entryCode,
}: {
  entryCode?: string;
  isCommissioner?: boolean;
}) {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const mobile = [
    ...primary,
    { href: "/menu", label: "Menu", icon: "menu" as const },
  ];
  return (
    <>
      <header className="app-header sticky top-0 z-40 border-b border-slate-700 bg-[#07090b]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2 sm:px-5">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2"
            aria-label="HPPP home"
          >
            <span className="grid size-8 place-items-center rounded-md border border-slate-500 bg-slate-200 text-[10px] font-black text-slate-950">
              HPPP
            </span>
            <span>
              <strong className="block text-xs font-black uppercase tracking-[0.16em]">
                NFL Pool
              </strong>
              <small className="block text-[9px] font-bold uppercase text-slate-400">
                2026{entryCode ? ` · ${entryCode}` : ""}
              </small>
            </span>
          </Link>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 sm:flex"
          >
            {[
              ...primary,
              { href: "/rules", label: "Rules", icon: "table" as const },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active(item.href) ? "page" : undefined}
                className={`rounded-md border px-3 py-2 text-[11px] font-black uppercase ${active(item.href) ? "control-pressed" : "control-raised text-slate-300"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/menu"
            className="control-raised grid size-9 place-items-center rounded-md border"
            aria-label="Menu"
          >
            <Icon name="menu" />
          </Link>
        </div>
      </header>
      <nav
        aria-label="Mobile primary"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-slate-700 bg-slate-950 sm:hidden"
      >
        {mobile.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active(item.href) ? "page" : undefined}
            className={`grid min-h-14 place-items-center py-1 text-[9px] font-black uppercase ${active(item.href) ? "bg-slate-100 text-slate-950" : "text-slate-400"}`}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
