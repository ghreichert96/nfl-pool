import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LinesTable, type EditableLine } from "./lines-table";
import { saveLinesBatch } from "./actions";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("./actions", () => ({
  saveLinesBatch: vi.fn(),
  refreshLines: vi.fn(),
  toggleLinesFreeze: vi.fn(),
  initializeUpcomingLines: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("retains edited values and override state when an atomic save fails", async () => {
  vi.mocked(saveLinesBatch).mockResolvedValue({
    ok: false,
    message: "Game changed. Reload before saving.",
  });
  const row: EditableLine = {
    game_id: 1,
    updated_at: "2026-10-10T00:00:00Z",
    away_spread: 3,
    total: 44,
    spread_override: false,
    total_override: false,
    game_type: "sunday",
    away: "BUF",
    home: "MIA",
    status: "scheduled",
    spread_book: "draftkings",
    total_book: "draftkings",
    spread_observed_at: null,
    total_observed_at: null,
  };
  render(
    <LinesTable
      weekId={1}
      weekNumber={1}
      weeks={[{ id: 1, week_number: 1, label: "Week 1" }]}
      frozen={false}
      rows={[row]}
    />,
  );
  fireEvent.change(
    screen.getByRole("spinbutton", { name: "BUF away_spread" }),
    { target: { value: "4.5" } },
  );
  fireEvent.click(screen.getByRole("button", { name: /Save/i }));
  await waitFor(() =>
    expect(
      screen.getByText("Game changed. Reload before saving."),
    ).toBeVisible(),
  );
  expect(
    screen.getByRole("spinbutton", { name: "BUF away_spread" }),
  ).toHaveValue(4.5);
  expect(saveLinesBatch).toHaveBeenCalledWith(1, [
    expect.objectContaining({ away_spread: 4.5, spread_override: true }),
  ]);
});
