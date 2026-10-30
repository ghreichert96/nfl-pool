import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  EntryPerformanceProvider,
  EntryDetailButton,
  EntryDetailRow,
} from "./entry-performance";
afterEach(cleanup);
it("opens on one tap, switches chart modes, traverses table order, and restores focus", () => {
  const entries = [2, 1].map((id) => ({
    id,
    name: `ENT${id}`,
    history: [
      {
        week: 1,
        overall: id,
        standings: id,
        weekly: 3 - id,
        provisional: false,
      },
    ],
    payouts: [{ label: "Main", rank: 1, amount: 100, explanation: "Rank 1" }],
  }));
  render(
    <EntryPerformanceProvider entries={entries}>
      <EntryDetailButton entryId={2}>ENT2</EntryDetailButton>
    </EntryPerformanceProvider>,
  );
  const trigger = screen.getByRole("button", {
    name: "Performance details for ENT2",
  });
  trigger.focus();
  fireEvent.click(trigger);
  expect(screen.getByRole("dialog", { name: "ENT2" })).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Overall Standing" }),
  ).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Main Weekly Ranking" }));
  expect(screen.getByRole("img")).toHaveAccessibleName(/main weekly ranking/);
  fireEvent.click(screen.getByRole("button", { name: "Next entry" }));
  expect(screen.getByRole("dialog", { name: "ENT1" })).toBeVisible();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowUp" });
  expect(screen.getByRole("dialog", { name: "ENT2" })).toBeVisible();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(trigger).toHaveFocus();
});

it("opens from a record cell and supports keyboard row activation", () => {
  render(
    <EntryPerformanceProvider
      entries={[{ id: 1, name: "TEST", history: [], payouts: [] }]}
    >
      <table>
        <tbody>
          <EntryDetailRow entryId={1} name="TEST">
            <th>TEST</th>
            <td>10-5-0</td>
          </EntryDetailRow>
        </tbody>
      </table>
    </EntryPerformanceProvider>,
  );
  fireEvent.click(screen.getByText("10-5-0"));
  expect(screen.getByRole("dialog", { name: "TEST" })).toBeVisible();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  const row = screen.getByRole("row", { name: "Performance details for TEST" });
  expect(row).toHaveFocus();
  fireEvent.keyDown(row, { key: "Enter" });
  expect(screen.getByRole("dialog")).toBeVisible();
});
