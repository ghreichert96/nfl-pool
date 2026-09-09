"use client";

import { useSyncExternalStore } from "react";

import { ThemeSelector } from "./theme-controls";

export const PREVIEW_MINIMIZED_KEY = "hppp:preview-minimized";
const preferenceEvent = "hppp-preview-preference";

function readPreference() {
  return window.localStorage.getItem(PREVIEW_MINIMIZED_KEY) === "true";
}

export function ProfilePreferences() {
  const minimized = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(preferenceEvent, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(preferenceEvent, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    readPreference,
    () => false,
  );
  return (
    <div className="grid gap-4">
      <ThemeSelector />
      <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-3">
        <div>
          <strong className="text-xs uppercase">Collapse picks preview</strong>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Start each visit with the preview minimized.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={minimized}
          onClick={() => {
            window.localStorage.setItem(
              PREVIEW_MINIMIZED_KEY,
              String(!minimized),
            );
            window.dispatchEvent(new Event(preferenceEvent));
          }}
          className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${minimized ? "border-emerald-400 bg-emerald-600" : "border-slate-600 bg-slate-800"}`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${minimized ? "translate-x-5" : "translate-x-0.5"}`}
          />
          <span className="sr-only">
            {minimized ? "Preview starts collapsed" : "Preview starts expanded"}
          </span>
        </button>
      </div>
    </div>
  );
}
