import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppNav } from "./app-nav";

const push = vi.fn();
const prefetch = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/grid",
  useRouter: () => ({ push, prefetch }),
}));

describe("AppNav menu", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ json: () => Promise.resolve({ summary: null }) }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens an anchored ordered flyout without a dark overlay", () => {
    render(<AppNav entryCode="HARR" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Menu" }).at(-1)!);

    const menu = screen.getByRole("dialog", { name: "Menu" });
    expect(menu).toHaveClass(
      "bottom-[calc(3.75rem+env(safe-area-inset-bottom))]",
    );
    expect(screen.getByRole("button", { name: "Close panel" })).toHaveClass(
      "bg-transparent",
    );
    expect(
      within(menu)
        .getAllByRole("link")
        .map((link) => link.textContent?.trim()),
    ).toEqual(["Profile", "Rules", "Submission Log", "Settings", "About"]);
    expect(within(menu).queryByRole("link", { name: "Admin" })).toBeNull();
  });

  it("adds Admin only for commissioners and closes on Escape", () => {
    render(<AppNav entryCode="HARR" isCommissioner />);
    fireEvent.click(screen.getAllByRole("button", { name: "Menu" }).at(-1)!);
    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Menu" })).toBeNull();
  });
});
