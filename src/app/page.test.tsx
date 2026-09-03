import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("renders both production candidate pick layouts", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "Week 1" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "A · DIRECT GRID" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "B · TAP + CHOOSE" }),
    ).toBeInTheDocument();
  });
});
