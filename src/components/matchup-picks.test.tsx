import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { MatchupPicksProvider, MatchupPicksTrigger } from "./matchup-picks";
import { loadMatchupPicks } from "@/features/picks/matchup-picks-action";
import { MOCK_GAMES } from "@/features/picks/mock-games";
import { PicksExperience } from "@/features/picks/picks-experience";

vi.mock("@/features/picks/matchup-picks-action");

const [first, second] = MOCK_GAMES;
const finalGame = { ...first, id: "1", status: "final" as const };
const label = `${first.away.abbreviation} at ${first.home.abbreviation}`;

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
  vi.mocked(loadMatchupPicks).mockResolvedValue({
    away: { team: first.away.abbreviation, picks: ["AAA", "BBB (BB)"] },
    home: { team: first.home.abbreviation, picks: ["CCC (UD)", "DDD (SD)"] },
    awaySpread: 8.5,
    total: 45.5,
    over: ["EEE"],
    under: ["FFF"],
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  vi.clearAllMocks();
});

it("opens the Picks matchup from the score and collapses it only with the chevron", async () => {
  render(
    <MatchupPicksProvider gameIds={[1]}>
      <PicksExperience
        games={[finalGame, { ...second, id: "2" }]}
        persistDraft={false}
      />
    </MatchupPicksProvider>,
  );

  expect(screen.getAllByRole("button", { name: /^Who picked/ })).toHaveLength(
    1,
  );
  fireEvent.click(screen.getByRole("button", { name: "Collapse final game" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(loadMatchupPicks).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: `Who picked ${label}?` }));
  const table = await screen.findByRole("table", {
    name: "Picks by team and total",
  });
  const [, sides, totals, totalPicks] = within(table).getAllByRole("row");
  const [away, , home] = within(sides).getAllByRole("cell");
  expect(away).toHaveTextContent("AAA");
  expect(away).toHaveTextContent("BBB (BB)");
  expect(home).toHaveTextContent("CCC (UD)");
  expect(home).toHaveTextContent("DDD (SD)");
  expect(totals).toHaveTextContent("O45.5");
  expect(totals).toHaveTextContent("U45.5");
  const [over, , under] = within(totalPicks).getAllByRole("cell");
  expect(over).toHaveTextContent("EEE");
  expect(under).toHaveTextContent("FFF");
  expect(loadMatchupPicks).toHaveBeenCalledWith(1);
  fireEvent.click(screen.getByRole("button", { name: "Close matchup picks" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Expand final game" }),
  ).toBeVisible();
});

it("makes only available picked cells actionable", async () => {
  render(
    <MatchupPicksProvider gameIds={[10]}>
      <table>
        <tbody>
          <tr>
            <td>
              <MatchupPicksTrigger gameId={10} label="GB at LAR" className="">
                GB
              </MatchupPicksTrigger>
            </td>
            <td>
              <MatchupPicksTrigger gameId={11} label="CHI at DET" className="">
                CHI
              </MatchupPicksTrigger>
            </td>
          </tr>
        </tbody>
      </table>
    </MatchupPicksProvider>,
  );
  fireEvent.click(screen.getByText("CHI"));
  expect(loadMatchupPicks).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Who picked GB at LAR?" }),
  );
  expect(
    await screen.findByRole("table", { name: "Picks by team and total" }),
  ).toBeVisible();
  expect(loadMatchupPicks).toHaveBeenCalledWith(10);
});
