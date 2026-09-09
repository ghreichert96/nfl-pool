import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StandingsTabs } from "./standings-tabs";
import { RouteProgress } from "./route-progress";
import { completeNavigation, startNavigation } from "./navigation-progress";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("view=overall&week=1"),
  useRouter: () => ({ push: vi.fn() }),
}));

describe("navigation feedback", () => {
  afterEach(cleanup);

  it("updates the standings selector immediately", () => {
    render(<StandingsTabs view="overall" weekNumber={1} />);
    const selector = screen.getByRole("combobox", { name: "Standings view" });
    fireEvent.change(selector, { target: { value: "main" } });
    expect(selector).toHaveValue("main");
  });

  it("shows and completes the footer progress bar", () => {
    render(<RouteProgress />);
    act(() => startNavigation());
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    act(() => completeNavigation());
    expect(screen.getByRole("progressbar")).toHaveClass(
      "route-progress-complete",
    );
  });
});
