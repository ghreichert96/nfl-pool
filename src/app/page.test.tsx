import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("identifies the pool rebuild", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "HPPP NFL Pool" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2026 foundation")).toBeInTheDocument();
  });
});
