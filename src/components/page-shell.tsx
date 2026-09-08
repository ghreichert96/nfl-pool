import type { ReactNode } from "react";

import { AppNav } from "./app-nav";

export function PageShell({
  children,
  entryCode,
  isCommissioner = false,
}: {
  children: ReactNode;
  entryCode?: string;
  isCommissioner?: boolean;
}) {
  return (
    <div className="pick-shell gunmetal min-h-screen bg-slate-950 pb-[calc(4rem+env(safe-area-inset-bottom))] text-slate-100 sm:pb-0">
      <AppNav entryCode={entryCode} isCommissioner={isCommissioner} />
      <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-5 sm:py-8">
        {children}
      </main>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
