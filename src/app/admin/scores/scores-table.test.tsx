import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ScoresTable, type ScoreRow } from "./scores-table";
import { saveScores, refreshScores } from "./actions";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("./actions", () => ({ saveScores: vi.fn(), refreshScores: vi.fn() }));
vi.mock("../actions", () => ({ releaseGameResultToProvider: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const row: ScoreRow = {
  game_id: 1,
  away: "BUF",
  home: "MIA",
  game_type: "sunday",
  status: "live",
  away_score: 14,
  home_score: 10,
  updated_at: "2026-10-11T20:00:00Z",
  source: null,
};
const props = {
  weekId: 1,
  weekNumber: 1,
  weeks: [{ id: 1, week_number: 1, label: "Week 1" }],
  rows: [row],
};
it("keeps the draft on save failure and against background score updates", async () => {
  vi.mocked(saveScores).mockResolvedValue({
    ok: false,
    message: "Scores changed. Edits retained.",
  });
  const { rerender } = render(<ScoresTable {...props} />);
  fireEvent.change(
    screen.getByRole("spinbutton", { name: "BUF at MIA away score" }),
    { target: { value: "21" } },
  );
  rerender(<ScoresTable {...props} rows={[{ ...row, away_score: 17 }]} />);
  expect(
    screen.getByRole("spinbutton", { name: "BUF at MIA away score" }),
  ).toHaveValue(21);
  fireEvent.click(screen.getByRole("button", { name: "Save finals (1)" }));
  await waitFor(() =>
    expect(screen.getByText("Scores changed. Edits retained.")).toBeVisible(),
  );
  expect(saveScores).toHaveBeenCalledWith(1, [
    expect.objectContaining({
      away_score: 21,
      home_score: 10,
      updated_at: row.updated_at,
    }),
  ]);
  expect(
    screen.getByRole("spinbutton", { name: "BUF at MIA away score" }),
  ).toHaveValue(21);
});
it("populates clean score fields from refreshed data and checks the selected week", async () => {
  vi.mocked(refreshScores).mockResolvedValue({
    ok: true,
    message: "Scores updated from ESPN.",
  });
  const { rerender } = render(<ScoresTable {...props} />);
  rerender(<ScoresTable {...props} rows={[{ ...row, away_score: 17 }]} />);
  expect(
    screen.getByRole("spinbutton", { name: "BUF at MIA away score" }),
  ).toHaveValue(17);
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh scores from ESPN" }),
  );
  await waitFor(() => expect(refreshScores).toHaveBeenCalledWith(1));
});
