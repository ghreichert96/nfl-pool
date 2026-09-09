"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { signOut } from "@/app/account/actions";

const primary = [
  { href: "/", label: "Picks", icon: "check" },
  { href: "/grid", label: "Grid", icon: "football" },
  { href: "/standings", label: "Standings", icon: "table" },
] as const;
const secondary = [
  { href: "/account", label: "Profile", icon: "profile" },
  { href: "/rules", label: "Rules", icon: "book" },
  { href: "/settings", label: "Settings", icon: "settings" },
  { href: "/about", label: "About", icon: "info" },
] as const;
type IconName =
  | "check"
  | "football"
  | "table"
  | "menu"
  | "profile"
  | "book"
  | "settings"
  | "history"
  | "info"
  | "admin"
  | "close";

function Icon({ name }: { name: IconName }) {
  const common = {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    className: "size-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
  } as const;
  if (name === "check")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </svg>
    );
  if (name === "football")
    return (
      <svg {...common}>
        <path d="M4.5 19.5c-2-2-1-7 2.5-10.5s8.5-4.5 10.5-2.5 1 7-2.5 10.5-8.5 4.5-10.5 2.5Z" />
        <path d="m8 16 8-8M10 11l3 3m-1-5 3 3" />
      </svg>
    );
  if (name === "table")
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="1" />
        <path d="M3 10h18M9 5v14" />
      </svg>
    );
  if (name === "profile")
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.25" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </svg>
    );
  if (name === "book")
    return (
      <svg {...common}>
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22V5.5ZM20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22V5.5Z" />
      </svg>
    );
  if (name === "settings")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 15 6l-.3-2.5h-4L10.4 6A8 8 0 0 0 9 7.1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.4.9l.3 2.7h4l.3-2.7a8 8 0 0 0 1.5-.9l2.4 1 2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z" />
      </svg>
    );
  if (name === "history")
    return (
      <svg {...common}>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </svg>
    );
  if (name === "info")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6" />
        <circle cx="12" cy="7.25" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  if (name === "admin")
    return (
      <svg {...common}>
        <path d="M12 3 4 6v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  if (name === "close")
    return (
      <svg {...common}>
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function pageHelp(pathname: string) {
  if (pathname === "/")
    return "Choose six MAIN picks, three totals, one underdog, and one Sudden Death team. Each selection locks at its game's kickoff.";
  if (pathname.startsWith("/grid"))
    return "The Picks Grid shows one week. Other entries' picks and Most Picked totals appear only after each game's kickoff.";
  if (pathname.startsWith("/standings"))
    return "Choose a week to see the standings snapshot immediately after that week.";
  if (pathname.startsWith("/admin"))
    return "Commissioner tools manage entrants, lines, results, rules, payouts, and testing. Administrative changes are audited.";
  if (pathname.startsWith("/rules"))
    return "These are the published pool rules. Commissioner prose edits are revisioned.";
  return "Use the navigation to move through the pool. Account and support pages are available from Menu.";
}

export function AppNav({
  entryCode,
  isCommissioner = false,
}: {
  entryCode?: string;
  isCommissioner?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [panel, setPanel] = useState<"menu" | "help" | "profile" | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const routeMatches = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const effectivePendingHref =
    pendingHref && !routeMatches(pendingHref) ? pendingHref : null;
  const active = (href: string) =>
    href === "/"
      ? (effectivePendingHref ?? pathname) === "/"
      : (effectivePendingHref ?? pathname).startsWith(href);
  useEffect(() => {
    primary.forEach(({ href }) => router.prefetch(href));
    secondary.forEach(({ href }) => router.prefetch(href));
  }, [router]);
  useEffect(() => {
    if (!pendingHref) return;
    const fallback = window.setTimeout(() => setPendingHref(null), 4000);
    return () => window.clearTimeout(fallback);
  }, [pendingHref]);
  useEffect(() => {
    if (!panel) return;
    const close = (event: KeyboardEvent) =>
      event.key === "Escape" && setPanel(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [panel]);
  const toggle = (next: "menu" | "help" | "profile") =>
    setPanel((current) => (current === next ? null : next));
  const menuItems = isCommissioner
    ? [...secondary, { href: "/admin", label: "Admin", icon: "admin" as const }]
    : secondary;
  return (
    <>
      <header className="app-header sticky top-0 z-40 border-b border-slate-700 bg-[#07090b]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2 sm:px-5">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2"
            aria-label="HPPP Picks"
          >
            <span className="grid size-8 place-items-center rounded-md border border-slate-500 bg-slate-200 text-[10px] font-black text-slate-950">
              HP
            </span>
            <span>
              <strong className="block text-xs font-black uppercase tracking-[0.16em]">
                Picks Pool
              </strong>
              <small className="block text-[9px] font-bold uppercase text-slate-400">
                2026
                {entryCode ? " · " : isCommissioner ? " · ADMIN" : ""}
                {entryCode && (
                  <span className="text-amber-300">{entryCode}</span>
                )}
              </small>
            </span>
          </Link>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 sm:flex"
          >
            {primary.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active(item.href) ? "page" : undefined}
                onPointerDown={() => setPendingHref(item.href)}
                onClick={() => setPendingHref(item.href)}
                className={`rounded-md border px-3 py-2 text-[11px] font-black uppercase ${active(item.href) ? "control-pressed" : "control-raised text-slate-300"}`}
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => toggle("menu")}
              aria-expanded={panel === "menu"}
              className="control-raised flex items-center gap-2 rounded-md border px-3 py-2 text-[11px] font-black uppercase"
            >
              <Icon name="menu" />
              Menu
            </button>
          </nav>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => toggle("help")}
              aria-label="About this page"
              aria-expanded={panel === "help"}
              className="control-raised grid size-9 place-items-center rounded-full border"
            >
              <Icon name="info" />
            </button>
            <button
              type="button"
              onClick={() => toggle("profile")}
              aria-label="Entry profile"
              aria-expanded={panel === "profile"}
              className="control-raised grid size-9 place-items-center rounded-full border"
            >
              <Icon name="profile" />
            </button>
          </div>
        </div>
      </header>
      {panel && (
        <button
          type="button"
          aria-label="Close panel"
          onClick={() => setPanel(null)}
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
        />
      )}
      {panel && (
        <section
          role="dialog"
          aria-modal="true"
          aria-label={
            panel === "menu"
              ? "Menu"
              : panel === "help"
                ? "Page information"
                : "Entry profile"
          }
          className="fixed inset-x-4 top-1/2 z-[60] mx-auto max-w-md -translate-y-1/2 rounded-xl border border-slate-600 bg-slate-950 p-3 shadow-2xl sm:inset-x-auto sm:right-5 sm:top-16 sm:w-80 sm:translate-y-0"
        >
          <div className="mb-3 flex items-center justify-between">
            <strong className="text-xs uppercase tracking-wider">
              {panel === "menu"
                ? "Menu"
                : panel === "help"
                  ? "What is this page?"
                  : "Your entry"}
            </strong>
            <button
              type="button"
              onClick={() => setPanel(null)}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-md text-slate-400"
            >
              <Icon name="close" />
            </button>
          </div>
          {panel === "menu" && (
            <nav className="grid gap-2" aria-label="Secondary">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onPointerDown={() => setPendingHref(item.href)}
                  onClick={() => {
                    setPendingHref(item.href);
                    setPanel(null);
                  }}
                  className="control-raised flex min-h-12 items-center gap-2 rounded-lg border px-3 text-xs font-black uppercase"
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
          {panel === "help" && (
            <p className="text-sm leading-6 text-slate-300">
              {pageHelp(pathname)}
            </p>
          )}
          {panel === "profile" && (
            <div className="space-y-2">
              <div className="rounded-lg bg-slate-900 p-3">
                <small className="block text-[9px] font-black uppercase text-slate-500">
                  Entry
                </small>
                <strong className="text-lg">
                  {entryCode ?? (isCommissioner ? "Commissioner" : "Account")}
                </strong>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/account"
                  onClick={() => setPanel(null)}
                  className="control-raised grid min-h-11 place-items-center rounded-lg border text-xs font-black"
                >
                  PROFILE
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setPanel(null)}
                  className="control-raised grid min-h-11 place-items-center rounded-lg border text-xs font-black"
                >
                  SETTINGS
                </Link>
              </div>
              <form action={signOut}>
                <button className="w-full rounded-lg border border-red-900 px-3 py-3 text-xs font-black text-red-300">
                  SIGN OUT
                </button>
              </form>
            </div>
          )}
        </section>
      )}
      <nav
        aria-label="Mobile primary"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-slate-700 bg-slate-950 pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {primary.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active(item.href) ? "page" : undefined}
            onPointerDown={() => setPendingHref(item.href)}
            onClick={() => setPendingHref(item.href)}
            aria-busy={effectivePendingHref === item.href || undefined}
            className={`grid min-h-14 place-items-center py-1 text-[9px] font-black uppercase ${active(item.href) ? "bg-slate-100 text-slate-950" : "text-slate-400"}`}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => toggle("menu")}
          aria-expanded={panel === "menu"}
          className={`grid min-h-14 place-items-center py-1 text-[9px] font-black uppercase ${panel === "menu" || pathname === "/menu" ? "bg-slate-100 text-slate-950" : "text-slate-400"}`}
        >
          <Icon name="menu" />
          <span>Menu</span>
        </button>
      </nav>
    </>
  );
}
