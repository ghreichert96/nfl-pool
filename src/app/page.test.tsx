import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("renders the consolidated mobile pick form", () => {
    render(<Home />);

    expect(screen.getByRole("combobox", { name: "Week" })).toHaveValue("1");
    expect(screen.getByRole("button", { name: "SF +8.5" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Over 45.5" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SUBMIT" })).toBeInTheDocument();
  });

  it("switches themes without changing the pick form", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Style: core" }));

    expect(
      screen.getByRole("button", { name: "Style: retro" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SF +8.5" })).toBeInTheDocument();
  });

  it("offers an in-row BB control and defaults BB only on submission", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "SF +8.5" }));

    expect(
      screen.getByRole("button", { name: "Make SF Best Bet in game row" }),
    ).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "SUBMIT" }));

    expect(screen.getByRole("button", { name: "SAVED" })).toBeInTheDocument();
    expect(screen.getByText("(BB = SF)")).toBeInTheDocument();
  });

  it("shows inline instructions and highlights incomplete submission status", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "How to make picks" }));
    expect(screen.getByText(/Pick 6 ATS and 3 totals/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "SUBMIT" }));
    expect(screen.getByLabelText("Submission saved")).toHaveClass(
      "bg-amber-950",
    );
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).not.toHaveClass("border");
  });

  it("offers a keyboard equivalent for switching the SD team", () => {
    render(<Home />);

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Sudden Death LAR" }),
      {
        key: "ArrowUp",
      },
    );

    expect(
      screen.getByRole("button", { name: "Sudden Death SF" }),
    ).toHaveTextContent("SD · SF");
  });

  it("collapses a started game and retains only relevant selections", () => {
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "SF +8.5" }));
    fireEvent.click(screen.getByRole("button", { name: "Over 45.5" }));
    fireEvent.click(screen.getByRole("button", { name: "Sudden Death LAR" }));
    fireEvent.click(screen.getByRole("button", { name: "live" }));

    expect(screen.getByText(/SF 24/)).toBeInTheDocument();
    expect(screen.getByText("SD LAR")).toBeInTheDocument();
    expect(screen.getByText("O45.5")).toBeInTheDocument();
    expect(screen.getByText("U45.5")).toBeInTheDocument();
    expect(screen.getByText("UD SF")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Over 45.5" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SF +8.5" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "SF +8.5" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "SF +8.5" })).toHaveClass(
      "border-amber-400",
    );
    expect(screen.getByRole("button", { name: /^SF,/ })).toHaveClass(
      "border-amber-400",
    );
  });
});
