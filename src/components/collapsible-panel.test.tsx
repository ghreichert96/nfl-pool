import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CollapsiblePanel } from "./collapsible-panel";

describe("CollapsiblePanel", () => {
  afterEach(cleanup);

  it("keeps a compact preview and makes the full header the toggle target", () => {
    render(
      <CollapsiblePanel
        title="Weekly grid"
        summary="HARR"
        preview={<span>Your picks</span>}
      >
        <span>All entries</span>
      </CollapsiblePanel>,
    );

    const toggle = screen.getByRole("button", {
      name: /Weekly grid\s*HARR/i,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Your picks")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("All entries")).toBeInTheDocument();
    expect(screen.queryByText("Your picks")).toBeNull();
  });
});
