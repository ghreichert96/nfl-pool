import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProfilePreferences } from "./profile-preferences";

describe("ProfilePreferences", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("keeps both preference thumbs centered inside their tracks", () => {
    render(<ProfilePreferences />);
    const toggles = screen.getAllByRole("switch");
    expect(toggles).toHaveLength(2);
    for (const toggle of toggles) {
      const thumb = toggle.querySelector("span:not(.sr-only)");
      expect(thumb).toHaveClass(
        "left-0.5",
        "top-1/2",
        "-translate-y-1/2",
        "translate-x-0",
      );
      fireEvent.click(toggle);
      expect(thumb).toHaveClass("translate-x-5");
    }
  });
});
