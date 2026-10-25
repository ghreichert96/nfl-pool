import { describe, expect, it, vi } from "vitest";
import { allRows } from "./all-rows";

describe("allRows", () => {
  it("reads past the API cap without dropping or duplicating rows", async () => {
    const rows = Array.from({ length: 1095 }, (_, id) => ({ id }));
    const range = vi.fn(async (from: number, to: number) => ({
      data: rows.slice(from, to + 1),
      error: null,
    }));
    expect((await allRows(() => ({ range }))).data).toEqual(rows);
    expect(range.mock.calls).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ]);
  });
  it("checks for the end after an exactly full page", async () => {
    const rows = Array.from({ length: 500 }, (_, id) => id);
    const range = vi.fn(async (from: number, to: number) => ({
      data: rows.slice(from, to + 1),
      error: null,
    }));
    expect((await allRows(() => ({ range }))).data).toEqual(rows);
    expect(range).toHaveBeenCalledTimes(2);
  });
  it("fails instead of scoring partial history when a later page fails", async () => {
    const error = new Error("Database unavailable");
    const range = vi
      .fn()
      .mockResolvedValueOnce({ data: Array(500).fill(1), error: null })
      .mockResolvedValueOnce({ data: null, error });
    await expect(allRows(() => ({ range }))).rejects.toBe(error);
  });
});
