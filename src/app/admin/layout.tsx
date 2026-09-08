import Link from "next/link";
import type { ReactNode } from "react";

import { requireCommissioner } from "@/lib/admin";

const tabs = [
  ["Overview", "/admin"],
  ["Lines", "/admin/lines"],
  ["Entrants", "/admin/entrants"],
  ["Picks", "/admin/picks"],
  ["Rules & messages", "/admin/manage"],
] as const;

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireCommissioner();
  return (
    <>
      <nav className="sticky top-0 z-40 overflow-x-auto border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur">
        <div className="mx-auto flex w-max min-w-full max-w-6xl gap-2 sm:px-2">
          {tabs.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="control-raised whitespace-nowrap rounded-md border px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-200"
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </>
  );
}
