"use client";

import { useEffect, useSyncExternalStore } from "react";

const themes = ["gunmetal", "retro", "light", "midnight"] as const;
type Theme = (typeof themes)[number];

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll(".pick-shell").forEach((shell) => {
    shell.classList.remove(...themes);
    shell.classList.add(theme);
  });
}

export function ThemeInitializer() {
  useEffect(() => {
    const stored = window.localStorage.getItem("hppp:theme");
    const theme = themes.includes(stored as Theme)
      ? (stored as Theme)
      : "gunmetal";
    applyTheme(theme);
    const applyPreferences = () => {
      document.documentElement.dataset.largeFont = String(
        window.localStorage.getItem("hppp:large-font") === "true",
      );
    };
    applyPreferences();
    window.addEventListener("hppp-display-preference", applyPreferences);
    window.addEventListener("storage", applyPreferences);
    return () => {
      window.removeEventListener("hppp-display-preference", applyPreferences);
      window.removeEventListener("storage", applyPreferences);
    };
  }, []);
  return null;
}

export function ThemeSelector() {
  const theme = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("hppp-theme", onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener("hppp-theme", onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => {
      const stored = window.localStorage.getItem("hppp:theme");
      return themes.includes(stored as Theme) ? (stored as Theme) : "gunmetal";
    },
    () => "gunmetal" as Theme,
  );

  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs font-black uppercase text-slate-400">
        Theme
      </legend>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {themes.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={theme === option}
            onClick={() => {
              window.localStorage.setItem("hppp:theme", option);
              applyTheme(option);
              window.dispatchEvent(new Event("hppp-theme"));
            }}
            className={`min-h-11 rounded-lg border text-xs font-black uppercase ${theme === option ? "control-pressed" : "control-raised"}`}
          >
            {option === "midnight" ? "Midnight navy" : option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
