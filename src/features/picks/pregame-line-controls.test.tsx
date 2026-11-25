import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { editPregameLine } from "./edit-pregame-line-action";
import { MOCK_GAMES } from "./mock-games";
import { PicksExperience } from "./picks-experience";

vi.mock("./edit-pregame-line-action");

const game = {
  ...MOCK_GAMES[0],
  id: "14",
  lineUpdatedAt: "2026-11-25T12:00:00Z",
  status: "upcoming" as const,
};
const matchup = `${game.away.abbreviation} at ${game.home.abbreviation}`;

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
      },
    },
  });
  vi.mocked(editPregameLine).mockResolvedValue({ ok: true, message: "" });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  vi.clearAllMocks();
});

it("uses a separate lock button and saves half-point changes with the editor's original line version", async () => {
  const { rerender } = render(
    <PicksExperience
      games={[{ ...game, lineFrozen: true }]}
      persistDraft={false}
    />,
  );
  expect(
    screen.queryByRole("button", { name: `Edit lines for ${matchup}` }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: `Unlock lines for ${matchup}` }),
  );
  await waitFor(() =>
    expect(editPregameLine).toHaveBeenCalledWith(14, { locked: false }),
  );
  rerender(
    <PicksExperience
      games={[{ ...game, lineFrozen: false }]}
      persistDraft={false}
    />,
  );

  fireEvent.click(
    screen.getByRole("button", { name: `Edit lines for ${matchup}` }),
  );
  const dialog = screen.getByRole("dialog", { name: "Edit matchup lines" });
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "Raise away spread by half a point",
    }),
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Lower total by half a point" }),
  );
  rerender(
    <PicksExperience
      games={[
        { ...game, lineFrozen: false, lineUpdatedAt: "2026-11-25T12:01:00Z" },
      ]}
      persistDraft={false}
    />,
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(editPregameLine).toHaveBeenLastCalledWith(14, {
      spread: game.awaySpread + 0.5,
      total: game.total - 0.5,
      updatedAt: game.lineUpdatedAt,
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it.each([
  { ...game, lineUpdatedAt: undefined },
  { ...game, status: "live" as const },
  { ...game, status: "final" as const },
])("omits line controls without pregame commissioner access", (fixture) => {
  render(<PicksExperience games={[fixture]} persistDraft={false} />);
  expect(
    screen.queryByRole("button", { name: /^(Lock|Unlock|Edit) lines for/ }),
  ).toBeNull();
});
