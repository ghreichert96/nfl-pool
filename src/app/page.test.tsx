import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MOCK_GAMES } from "../features/picks/mock-games";
import { PicksExperience } from "../features/picks/picks-experience";

const liveGames = () =>
  MOCK_GAMES.map((game, index) =>
    index === 0 ? { ...game, status: "live" as const } : game,
  );

describe("Home", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("renders the consolidated mobile pick form", () => {
    render(<PicksExperience />);

    expect(screen.getByRole("combobox", { name: "Week" })).toHaveValue("1");
    expect(screen.getByRole("button", { name: "SF +8.5" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Over 45.5" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SUBMIT" })).toBeInTheDocument();
    expect(screen.getByText("TNF")).toHaveClass("bg-teal-400");
    expect(screen.getByText("INTL")).toHaveClass("bg-cyan-400");
    expect(screen.getAllByText("1 PM")[0]).toHaveClass("bg-blue-400");
  });

  it("shows inline line and submission status", () => {
    render(<PicksExperience />);

    expect(screen.getByText(/Lines · Unfrozen/)).toBeInTheDocument();
    expect(screen.getByText(/Picks · Not Submitted/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SF +8.5" })).toBeInTheDocument();
  });

  it("offers an in-row BB control and defaults BB only on submission", () => {
    render(<PicksExperience />);

    fireEvent.click(screen.getByRole("button", { name: "SF +8.5" }));

    expect(
      screen.getByRole("button", { name: "Make SF Best Bet in game row" }),
    ).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "SUBMIT" }));

    expect(screen.getByRole("button", { name: "SAVED" })).toBeInTheDocument();
    expect(screen.getByText("(BB = SF)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "LAR -8.5" }));
    expect(screen.getByText("Modified")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "LAR, Best Bet" })).toHaveClass(
      "pick-modified",
    );
  });

  it("shows the comment editor below the games and highlights incomplete submission status", () => {
    render(<PicksExperience />);

    expect(
      screen.getByRole("textbox", { name: "Weekly comment" }),
    ).toHaveAttribute("maxlength", "40");
    expect(screen.getByRole("textbox", { name: "Weekly comment" })).toHaveClass(
      "text-base",
    );

    fireEvent.click(screen.getByRole("button", { name: "SUBMIT" }));
    expect(screen.getByLabelText("Submission saved")).toHaveClass(
      "bg-amber-950",
    );
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).not.toHaveClass("border");
  });

  it("keeps the preview toggle clear of actions in both positions", () => {
    render(<PicksExperience />);

    const minimize = screen.getByRole("button", {
      name: "Minimize picks preview",
    });
    expect(minimize).toHaveClass("rounded-b-md");
    fireEvent.click(minimize);

    const expand = screen.getByRole("button", {
      name: "Expand picks preview",
    });
    expect(expand).toHaveClass("-top-7", "rounded-t-md");
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });

  it("limits a removed BB highlight and gives live state visual priority", () => {
    const { rerender } = render(<PicksExperience />);

    fireEvent.click(screen.getByRole("button", { name: "SF +8.5" }));
    fireEvent.click(screen.getByRole("button", { name: "SUBMIT" }));
    fireEvent.click(screen.getByRole("button", { name: "SF, Best Bet" }));

    expect(
      screen.getByLabelText("Main picks").querySelectorAll(".pick-modified"),
    ).toHaveLength(1);

    rerender(<PicksExperience games={liveGames()} />);

    expect(
      screen.getByLabelText("Main picks").querySelectorAll(".pick-modified"),
    ).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "SF, mark Best Bet" }),
    ).toHaveClass("border-amber-400");
  });

  it("offers a keyboard equivalent for switching the SD team", () => {
    render(<PicksExperience />);

    fireEvent.keyDown(
      screen.getByRole("button", { name: "Sudden Death LAR" }),
      {
        key: "ArrowUp",
      },
    );

    expect(
      screen.getByRole("button", { name: "Sudden Death SF" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("reveals the alternate SD team on a quick double tap", () => {
    render(<PicksExperience />);

    fireEvent.click(screen.getByRole("button", { name: "Sudden Death LAR" }));
    fireEvent.click(screen.getByRole("button", { name: "Sudden Death LAR" }));

    const alternate = screen.getByRole("button", { name: "Sudden Death SF" });
    expect(alternate).toHaveTextContent("SF · SD");
    expect(alternate).toHaveClass("sd-card-flip");

    fireEvent.click(alternate);
    expect(
      screen.getByRole("button", { name: "Sudden Death SF" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("collapses a started game and retains only relevant selections", () => {
    const { rerender } = render(<PicksExperience />);

    fireEvent.click(screen.getByRole("button", { name: "SF +8.5" }));
    fireEvent.click(screen.getByRole("button", { name: "Over 45.5" }));
    fireEvent.click(screen.getByRole("button", { name: "Sudden Death LAR" }));
    rerender(<PicksExperience games={liveGames()} />);

    expect(screen.getByText(/SF 24/)).toBeInTheDocument();
    expect(screen.getAllByText("LAR·SD")).toHaveLength(2);
    expect(screen.getByText("O45.5")).toBeInTheDocument();
    expect(screen.getByText("U45.5")).toBeInTheDocument();
    expect(screen.getByText("SF·UD")).toBeInTheDocument();
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
