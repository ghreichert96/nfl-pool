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
}));

describe("navigation feedback", () => {
  afterEach(cleanup);

  it("marks a standings tab pressed as soon as it is touched", () => {
    render(<StandingsTabs view="overall" weekNumber={1} />);
    const main = screen.getByRole("link", { name: "Main" });
    fireEvent.pointerDown(main);
    expect(main).toHaveClass("control-pressed");
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
