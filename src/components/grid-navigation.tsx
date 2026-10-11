"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { NAV_PREVIEW_KEY, useDisplayPreference } from "./profile-preferences";
const GridContext = createContext<{
  preview: boolean;
  tab: string;
  setTab: (tab: string) => void;
}>({ preview: false, tab: "Weekly grid", setTab: () => {} });
export function GridNavigation({ children }: { children: ReactNode }) {
  const preview = useDisplayPreference(NAV_PREVIEW_KEY);
  const [tab, setTab] = useState("Weekly grid");
  return (
    <GridContext.Provider value={{ preview, tab, setTab }}>
      {children}
    </GridContext.Provider>
  );
}
export function useGridNavigation() {
  return useContext(GridContext);
}
export function GridNavigationTitle() {
  const { preview, tab, setTab } = useGridNavigation();
  if (!preview) return <>Picks Grid</>;
  return (
    <span role="tablist" aria-label="Grid view" className="flex gap-1">
      {["Weekly grid", "Most Picked", "Weekly Standings"].map((label) => (
        <button
          key={label}
          type="button"
          role="tab"
          aria-selected={tab === label}
          onClick={() => setTab(label)}
          className={`min-h-9 rounded px-2 text-[10px] ${tab === label ? "control-pressed" : "control-raised"}`}
        >
          {label === "Weekly grid" ? "Grid" : label}
        </button>
      ))}
    </span>
  );
}
