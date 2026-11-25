"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

export function LiveScoreRefresh({
  enabled,
  deadlineDelayMs,
}: {
  enabled: boolean;
  deadlineDelayMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled && deadlineDelayMs === undefined) return;
    const deadline =
      deadlineDelayMs === undefined
        ? null
        : performance.now() + deadlineDelayMs;
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const interval = enabled
      ? window.setInterval(refresh, REFRESH_INTERVAL_MS)
      : undefined;
    const timeout =
      deadlineDelayMs === undefined
        ? undefined
        : window.setTimeout(refresh, deadlineDelayMs);
    const onVisibilityChange = () => {
      if (enabled || (deadline !== null && performance.now() >= deadline)) {
        refresh();
      }
    };
    window.addEventListener("focus", onVisibilityChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      window.removeEventListener("focus", onVisibilityChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [deadlineDelayMs, enabled, router]);

  return null;
}
