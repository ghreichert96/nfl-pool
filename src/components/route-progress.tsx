"use client";

import { useEffect, useRef, useState } from "react";

import { NAVIGATION_COMPLETE, NAVIGATION_START } from "./navigation-progress";

export function RouteProgress() {
  const [state, setState] = useState<"idle" | "loading" | "complete">("idle");
  const finishTimer = useRef<number | null>(null);
  const fallbackTimer = useRef<number | null>(null);
  const active = useRef(false);

  useEffect(() => {
    const clearFinishTimer = () => {
      if (finishTimer.current !== null)
        window.clearTimeout(finishTimer.current);
    };
    const clearFallbackTimer = () => {
      if (fallbackTimer.current !== null)
        window.clearTimeout(fallbackTimer.current);
    };
    const start = () => {
      clearFinishTimer();
      clearFallbackTimer();
      active.current = true;
      setState("loading");
      fallbackTimer.current = window.setTimeout(() => {
        active.current = false;
        setState("idle");
      }, 5000);
    };
    const complete = () => {
      if (!active.current) return;
      active.current = false;
      clearFinishTimer();
      clearFallbackTimer();
      setState("complete");
      finishTimer.current = window.setTimeout(() => setState("idle"), 180);
    };
    window.addEventListener(NAVIGATION_START, start);
    window.addEventListener(NAVIGATION_COMPLETE, complete);
    return () => {
      clearFinishTimer();
      clearFallbackTimer();
      window.removeEventListener(NAVIGATION_START, start);
      window.removeEventListener(NAVIGATION_COMPLETE, complete);
    };
  }, []);

  if (state === "idle") return null;
  return (
    <span
      role="progressbar"
      aria-label="Loading page"
      className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden ${state === "complete" ? "route-progress-complete" : "route-progress-loading"}`}
    >
      <span className="block h-full bg-cyan-400 shadow-[0_0_5px_#22d3ee]" />
    </span>
  );
}
