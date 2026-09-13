import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SubmissionRevisionLog } from "./submission-revision-log";

describe("SubmissionRevisionLog", () => {
  afterEach(cleanup);

  it("shows additions and removals for every commissioner revision", () => {
    render(
      <SubmissionRevisionLog
        revisions={[
          { id: 3, revision: 3, submitted_at: "2026-09-11T00:10:00Z" },
          { id: 2, revision: 2, submitted_at: "2026-09-10T22:40:00Z" },
          { id: 1, revision: 1, submitted_at: "2026-09-10T13:41:00Z" },
        ]}
        games={[
          { id: 1, away_team: "NE", home_team: "SEA" },
          { id: 2, away_team: "SF", home_team: "LAR" },
        ]}
        picks={[
          {
            submission_id: 1,
            game_id: 1,
            kind: "ats",
            team: "SEA",
            total_direction: null,
            is_best_bet: true,
          },
          {
            submission_id: 2,
            game_id: 1,
            kind: "ats",
            team: "SEA",
            total_direction: null,
            is_best_bet: false,
          },
          {
            submission_id: 2,
            game_id: 2,
            kind: "total",
            team: null,
            total_direction: "under",
            is_best_bet: false,
          },
          {
            submission_id: 3,
            game_id: 2,
            kind: "ats",
            team: "LAR",
            total_direction: null,
            is_best_bet: false,
          },
          {
            submission_id: 3,
            game_id: 2,
            kind: "total",
            team: null,
            total_direction: "under",
            is_best_bet: false,
          },
        ]}
        commissionerSubmissionIds={[2, 3]}
      />,
    );

    expect(screen.getAllByText("Commissioner")).toHaveLength(2);
    expect(screen.getByText("+ SEA ATS")).toHaveClass("text-emerald-300");
    expect(screen.getByText("− SEA ATS BB")).toHaveClass("text-red-300");
    expect(screen.getByText("+ SF/LAR U")).toHaveClass("text-emerald-300");
    expect(screen.getByText("+ LAR ATS")).toHaveClass("text-emerald-300");
    expect(screen.getByText("− SEA ATS")).toHaveClass("text-red-300");
  });
});
