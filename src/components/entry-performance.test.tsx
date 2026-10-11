import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  EntryPerformanceProvider,
  EntryDetailButton,
} from "./entry-performance";
afterEach(cleanup);
it("opens on one tap, switches chart modes, traverses table order, and restores focus", () => {
  const entries = [2, 1].map((id) => ({
    id,
    name: `ENT${id}`,
    history: [{ week: 1, standings: id, weekly: 3 - id, provisional: false }],
    payouts: [{ label: "Main", amount: 100, explanation: "Rank 1" }],
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
  expect(screen.getByRole("button", { name: "Standings" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Weekly rank" }));
  expect(screen.getByRole("img")).toHaveAccessibleName(/weekly rank/);
  fireEvent.click(screen.getByRole("button", { name: "Next entry" }));
  expect(screen.getByRole("dialog", { name: "ENT1" })).toBeVisible();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowUp" });
  expect(screen.getByRole("dialog", { name: "ENT2" })).toBeVisible();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(trigger).toHaveFocus();
});
