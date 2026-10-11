"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { NAV_PREVIEW_KEY, useDisplayPreference } from "./profile-preferences";
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
  const preview = useDisplayPreference(NAV_PREVIEW_KEY);
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationKey = searchParams.toString();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    completeNavigation();
  }, [locationKey]);

  const visibleView = pending && pending !== view ? pending : view;
  if (preview)
    return (
      <div role="tablist" aria-label="Standings view" className="flex gap-1">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={visibleView === key}
            onClick={() => {
              setPending(key);
              startNavigation();
              router.push(
                `/standings?view=${key}${weekNumber ? `&week=${weekNumber}` : ""}`,
              );
            }}
            className={`min-h-9 rounded border px-2 text-[10px] font-black ${visibleView === key ? "control-pressed" : "control-raised"}`}
          >
            {key === "sd" ? "SD" : key === "ud" ? "UD" : label}
          </button>
        ))}
      </div>
    );
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
      className="control-raised min-h-9 w-32 rounded-md border px-2 text-xs font-black"
    >
      {tabs.map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function StandingsTitle() {
  return useDisplayPreference(NAV_PREVIEW_KEY) ? null : <>Standings</>;
}
