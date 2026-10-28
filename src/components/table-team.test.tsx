import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { ProfilePreferences, TEXT_TEAMS_KEY } from "./profile-preferences";
import { TableTeam } from "./table-team";
beforeEach(() => window.localStorage.clear());
afterEach(cleanup);
it("switches team display immediately and persists the setting", () => {
  render(
    <>
      <ProfilePreferences />
      <TableTeam team="BUF" src="https://example.com/buf.png" />
    </>,
  );
  expect(screen.getByLabelText("BUF").querySelector("img")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Text" }));
  expect(screen.getByLabelText("BUF").querySelector("img")).toBeNull();
  expect(screen.getByLabelText("BUF")).toHaveTextContent("BUF");
  expect(window.localStorage.getItem(TEXT_TEAMS_KEY)).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Logos" }));
  expect(screen.getByLabelText("BUF").querySelector("img")).not.toBeNull();
});
