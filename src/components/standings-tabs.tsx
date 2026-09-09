"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { completeNavigation, startNavigation } from "./navigation-progress";

const tabs = [
  ["overall", "Overall"],
  ["main", "Main"],
  ["sd", "Sudden Death"],
  ["ud", "Underdog"],
] as const;

export function StandingsTabs({
  view,
  weekNumber,
}: {
  view: string;
  weekNumber?: number;
}) {
  const searchParams = useSearchParams();
  const locationKey = searchParams.toString();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    completeNavigation();
  }, [locationKey]);

  const visibleView = pending && pending !== view ? pending : view;
  return (
    <nav
      aria-label="Standings views"
      className="mb-4 grid grid-cols-4 rounded-lg border border-slate-700 bg-slate-950 p-1"
    >
      {tabs.map(([key, label]) => (
        <Link
          key={key}
          href={`/standings?view=${key}${weekNumber ? `&week=${weekNumber}` : ""}`}
          aria-current={visibleView === key ? "page" : undefined}
          onPointerDown={() => {
            setPending(key);
            startNavigation();
          }}
          onClick={() => {
            setPending(key);
            startNavigation();
          }}
          className={`grid min-h-10 place-items-center rounded-md text-[10px] font-black uppercase transition-colors ${visibleView === key ? "control-pressed" : "text-slate-400"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
