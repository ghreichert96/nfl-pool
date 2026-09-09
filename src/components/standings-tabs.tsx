"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationKey = searchParams.toString();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    completeNavigation();
  }, [locationKey]);

  const visibleView = pending && pending !== view ? pending : view;
  return (
    <select
      aria-label="Standings view"
      value={visibleView}
      onChange={(event) => {
        const next = event.target.value;
        setPending(next);
        startNavigation();
        router.push(
          `/standings?view=${next}${weekNumber ? `&week=${weekNumber}` : ""}`,
        );
      }}
      className="control-raised min-h-9 max-w-28 rounded-md border px-2 text-xs font-black uppercase"
    >
      {tabs.map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}
