import { fireEvent, render } from "@testing-library/react";
import { expect, it } from "vitest";
import { StickyTableHeader } from "./sticky-table-header";

it("keeps one visible header outside the body scroller and synchronizes horizontal scrolling", () => {
  const { container } = render(
    <StickyTableHeader columnWidths={[28, 44, 48]}>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>Week 1</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>HARR</td>
            <td>BUF</td>
          </tr>
        </tbody>
      </table>
    </StickyTableHeader>,
  );
  const heads = container.querySelectorAll("thead");
  expect(heads).toHaveLength(2);
  expect(heads[1]).toHaveClass("sr-only");
  const header = container.querySelector(
    '[aria-hidden="true"]',
  ) as HTMLDivElement;
  expect(header).toHaveClass("sticky");
  const scroller = container.querySelector(
    ".overflow-x-auto",
  ) as HTMLDivElement;
  fireEvent.scroll(scroller, { target: { scrollLeft: 90 } });
  expect(header.scrollLeft).toBe(90);
  expect(container.querySelectorAll("colgroup")).toHaveLength(2);
});
