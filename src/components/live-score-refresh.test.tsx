import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { LiveScoreRefresh } from "./live-score-refresh";

const { router } = vi.hoisted(() => ({ router: { refresh: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  router.refresh.mockClear();
});

it("refreshes at the deadline even before games are live", () => {
  vi.useFakeTimers();
  render(<LiveScoreRefresh enabled={false} deadlineDelayMs={2_000} />);
  vi.advanceTimersByTime(1_999);
  expect(router.refresh).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(router.refresh).toHaveBeenCalledTimes(1);
});

it("refreshes when a tab becomes visible after missing the deadline", () => {
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, "visibilityState", "get");
  visibility.mockReturnValue("hidden");
  render(<LiveScoreRefresh enabled={false} deadlineDelayMs={2_000} />);
  vi.advanceTimersByTime(2_000);
  expect(router.refresh).not.toHaveBeenCalled();
  visibility.mockReturnValue("visible");
  document.dispatchEvent(new Event("visibilitychange"));
  expect(router.refresh).toHaveBeenCalledTimes(1);
});
