import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MOCK_GAMES } from "../features/picks/mock-games";
import { PicksExperience } from "../features/picks/picks-experience";

const liveGames = () =>
  MOCK_GAMES.map((game, index) =>
    index === 0 ? { ...game, status: "live" as const } : game,
  );

const finalGames = () =>
  MOCK_GAMES.map((game, index) =>
    index === 0 ? { ...game, status: "final" as const } : game,
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
    expect(
      screen
        .getByRole("button", { name: "LAR -8.5" })
        .querySelector(".team-logo-bare"),
    ).toBeInTheDocument();
  });

  it("shows inline line and submission status", () => {
    render(<PicksExperience />);

    expect(screen.getByLabelText("Lines unlocked")).toHaveTextContent("Lines");
    expect(screen.getByLabelText("Picks not submitted")).toHaveTextContent(
      "Picks",
    );

    fireEvent.click(screen.getByRole("button", { name: "SF +8.5" }));
    expect(screen.getByLabelText("Picks not submitted")).toBeInTheDocument();
  });

  it("shows the green Picks check only for a complete saved submission", () => {
    const complete = {
      ats: MOCK_GAMES.slice(0, 6).map((game) => ({
        gameId: game.id,
        team: game.away.abbreviation,
      })),
      totals: MOCK_GAMES.slice(0, 3).map((game) => ({
        gameId: game.id,
        direction: "over" as const,
      })),
      bestBet: {
        gameId: MOCK_GAMES[0].id,
        team: MOCK_GAMES[0].away.abbreviation,
      },
      suddenDeath: {
        gameId: MOCK_GAMES[0].id,
        team: MOCK_GAMES[0].home.abbreviation,
      },
      underdog: {
        gameId: MOCK_GAMES[0].id,
        team: MOCK_GAMES[0].away.abbreviation,
      },
    };

    render(
      <PicksExperience
        initialPicks={complete}
        initialSubmittedPicks={complete}
      />,
    );

    const submittedStatus = screen.getByLabelText("Picks submitted");
    expect(submittedStatus).toHaveClass("text-emerald-300");
    expect(submittedStatus.querySelector("svg")).toBeInTheDocument();
  });

  it("never defaults BB and clears it when its ATS selection changes", () => {
    render(<PicksExperience />);

    fireEvent.click(screen.getByRole("button", { name: "SF +8.5" }));

    expect(
      screen.getByRole("button", { name: "Make SF Best Bet in game row" }),
    ).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(
      screen.getByRole("button", { name: "Make SF Best Bet in game row" }),
    );
    expect(screen.getByRole("button", { name: "SF, Best Bet" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "LAR -8.5" }));
    expect(
      screen.getByRole("button", { name: "LAR, mark Best Bet" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "SUBMIT" }));

    expect(screen.getByRole("button", { name: "SAVED" })).toBeInTheDocument();
    expect(screen.queryByText(/BB =/)).not.toBeInTheDocument();
  });

  it("includes ATS spreads and total numbers in the picks preview", () => {
    render(<PicksExperience />);

    fireEvent.click(screen.getByRole("button", { name: "SF +8.5" }));
    fireEvent.click(screen.getByRole("button", { name: "Over 45.5" }));

    const preview = screen.getByRole("button", {
      name: "SF, mark Best Bet",
    });
    expect(preview).toHaveTextContent("+8.5");
    expect(preview.querySelector(".team-logo-bare")).toBeInTheDocument();
    expect(preview.querySelector(".team-logo")).not.toBeInTheDocument();
    expect(screen.getByLabelText("SF at LAR, over")).toHaveTextContent("O45.5");
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
    expect(
      screen.getByLabelText("Picks submitted incomplete"),
    ).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });

  it("keeps incomplete saved picks gold while exposing unsaved changes", () => {
    render(<PicksExperience />);

    fireEvent.click(screen.getByRole("button", { name: "SF +8.5" }));
    fireEvent.click(screen.getByRole("button", { name: "SUBMIT" }));
    fireEvent.click(screen.getByRole("button", { name: "LAR -8.5" }));

    expect(
      screen.getByLabelText("Picks submitted incomplete"),
    ).toBeInTheDocument();
    expect(screen.getByText("Modified")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revert" })).toBeEnabled();
  });

  it("reverts an edited draft to the latest successful submission", () => {
    render(<PicksExperience />);

    fireEvent.click(screen.getByRole("button", { name: "SF +8.5" }));
    fireEvent.click(screen.getByRole("button", { name: "SUBMIT" }));
    fireEvent.click(screen.getByRole("button", { name: "LAR -8.5" }));
    fireEvent.click(screen.getByRole("button", { name: "Revert" }));

    expect(screen.getByRole("button", { name: "SF +8.5" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "LAR -8.5" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Revert" })).toBeDisabled();
  });

  it("keeps the preview toggle clear of actions in both positions", () => {
    render(<PicksExperience />);

    const minimize = screen.getByRole("button", {
      name: "Minimize picks preview",
    });
    expect(minimize).toHaveClass("top-0", "rounded-b-md");
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
    fireEvent.click(
      screen.getByRole("button", { name: "Make SF Best Bet in game row" }),
    );
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

  it("keeps locked selections when Clear removes the editable draft", () => {
    const submitted = {
      ats: [{ gameId: "sf-lar", team: "SF" }],
      totals: [{ gameId: "sf-lar", direction: "over" as const }],
      bestBet: null,
      suddenDeath: null,
      underdog: null,
    };

    render(
      <PicksExperience
        games={liveGames()}
        initialPicks={submitted}
        initialSubmittedPicks={submitted}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("button", { name: "SF +8.5" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("O45.5")).toBeInTheDocument();
  });

  it("shows fixed result markers for every completed-game choice", () => {
    render(<PicksExperience games={finalGames()} />);

    expect(screen.getAllByLabelText("win result").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("loss result").length).toBeGreaterThan(0);
    const spread = screen.getByRole("button", { name: "SF +8.5" });
    expect(spread).toHaveClass("bg-slate-900/70");
    expect(spread.querySelector(".opacity-35")).toBeInTheDocument();
    expect(spread.querySelector('[aria-label$="result"]')).not.toHaveClass(
      "opacity-35",
    );
  });

  it("collapses a final game into its compact score row", () => {
    render(<PicksExperience games={finalGames()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse final game" }),
    );

    expect(screen.getByText("SF 24, LAR 21 F")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand final game" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Final")).not.toBeInTheDocument();
  });

  it("uses P for an ATS push marker", () => {
    const pushed = finalGames().map((game, index) =>
      index === 0 && game.result
        ? { ...game, result: { ...game.result, atsWinner: null } }
        : game,
    );
    render(<PicksExperience games={pushed} />);

    expect(screen.getAllByLabelText("tie result")[0]).toHaveTextContent("P");
  });

  it("lets a commissioner replace selections in a completed game", () => {
    render(<PicksExperience games={finalGames()} allowLockedEdits />);

    const away = screen.getByRole("button", { name: "SF +8.5" });
    const over = screen.getByRole("button", { name: "Over 45.5" });
    expect(away).toBeEnabled();
    expect(over).toBeEnabled();

    fireEvent.click(away);
    fireEvent.click(over);
    expect(away).toHaveAttribute("aria-pressed", "true");
    expect(over).toHaveAttribute("aria-pressed", "true");
  });

  it("distinguishes the unsaved Submit treatment from Saved", () => {
    render(<PicksExperience />);

    expect(screen.getByRole("button", { name: "SUBMIT" })).toHaveClass(
      "text-white",
    );
    fireEvent.click(screen.getByRole("button", { name: "SUBMIT" }));
    expect(screen.getByRole("button", { name: "SAVED" })).toHaveClass(
      "text-slate-950",
    );
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
