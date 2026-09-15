"use client";

import { useSyncExternalStore } from "react";

import { ThemeSelector } from "./theme-controls";

export const PREVIEW_MINIMIZED_KEY = "hppp:preview-minimized";
export const FINAL_GAMES_MINIMIZED_KEY = "hppp:final-games-minimized";
const preferenceEvent = "hppp-display-preference";

function readPreference(key: string) {
  return window.localStorage.getItem(key) === "true";
}

function PreferenceSwitch({
  storageKey,
  label,
  description,
}: {
  storageKey: string;
  label: string;
  description: string;
}) {
  const checked = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(preferenceEvent, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(preferenceEvent, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => readPreference(storageKey),
    () => false,
  );

  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-3">
      <div>
        <strong className="text-xs uppercase">{label}</strong>
        <p className="mt-0.5 text-[11px] text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        onClick={() => {
          window.localStorage.setItem(storageKey, String(!checked));
          window.dispatchEvent(new Event(preferenceEvent));
        }}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${checked ? "border-emerald-300 bg-emerald-600" : "border-slate-600 bg-slate-800"}`}
      >
        <span
          className={`absolute top-1/2 left-0.5 size-[18px] -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
        <span className="sr-only">{checked ? "Collapsed" : "Expanded"}</span>
      </button>
    </div>
  );
}

export function ProfilePreferences() {
  return (
    <div className="grid gap-4">
      <ThemeSelector />
      <PreferenceSwitch
        storageKey={PREVIEW_MINIMIZED_KEY}
        label="Collapse picks preview"
        description="Start each visit with the preview minimized."
      />
      <PreferenceSwitch
        storageKey={FINAL_GAMES_MINIMIZED_KEY}
        label="Collapse final games"
        description="Start completed game rows in their compact view."
      />
    </div>
  );
}
