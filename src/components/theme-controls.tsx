"use client";

import { useEffect, useSyncExternalStore } from "react";

const themes = ["gunmetal", "retro", "light"] as const;
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
      <div className="grid grid-cols-3 gap-2">
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
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
