import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProfilePreferences } from "./profile-preferences";

describe("ProfilePreferences", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("keeps the picks-preview thumb centered in both states", () => {
    render(<ProfilePreferences />);
    const toggle = screen.getByRole("switch");
    const thumb = toggle.querySelector("span:not(.sr-only)");
    expect(thumb).toHaveClass("left-0.5", "top-0.5", "translate-x-0");
    fireEvent.click(toggle);
    expect(thumb).toHaveClass("translate-x-5");
  });
});
