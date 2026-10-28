"use client";

import { useSyncExternalStore } from "react";

import { ThemeSelector } from "./theme-controls";

export const PREVIEW_MINIMIZED_KEY = "hppp:preview-minimized";
export const FINAL_GAMES_MINIMIZED_KEY = "hppp:final-games-minimized";
export const NAV_PREVIEW_KEY = "hppp:nav-preview";
export const TEXT_TEAMS_KEY = "hppp:text-teams";
export const LARGE_FONT_KEY = "hppp:large-font";
const preferenceEvent = "hppp-display-preference";

function readPreference(key: string) {
  return window.localStorage.getItem(key) === "true";
}

export function useDisplayPreference(key: string) {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(preferenceEvent, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(preferenceEvent, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => readPreference(key),
    () => false,
  );
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
  const checked = useDisplayPreference(storageKey);

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
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

export function ProfilePreferences() {
  return (
    <div className="grid gap-4">
      <ThemeSelector />
      <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-3">
        <div>
          <strong className="text-xs uppercase">Text vs. logos</strong>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Team display on Grid and SD/UD standings.
          </p>
        </div>
        <TeamDisplaySelector />
      </div>
      <PreferenceSwitch
        storageKey={LARGE_FONT_KEY}
        label="Increase font size"
        description="Slightly larger text on this device."
      />
      <PreferenceSwitch
        storageKey={NAV_PREVIEW_KEY}
        label="Preview header tabs"
        description="Try tabs for Grid and Standings. Turn off to restore the current layout."
      />
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

function TeamDisplaySelector() {
  const text = useDisplayPreference(TEXT_TEAMS_KEY);
  return (
    <div role="group" aria-label="Text vs. logos" className="flex gap-1">
      {[false, true].map((value) => (
        <button
          key={String(value)}
          type="button"
          aria-pressed={text === value}
          className={`rounded-md border px-3 py-2 text-xs font-bold ${text === value ? "submit-saved" : "submit-neutral"}`}
          onClick={() => {
            window.localStorage.setItem(TEXT_TEAMS_KEY, String(value));
            window.dispatchEvent(new Event(preferenceEvent));
          }}
        >
          {value ? "Text" : "Logos"}
        </button>
      ))}
    </div>
  );
}
