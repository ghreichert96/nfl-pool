import { describe, expect, it, vi } from "vitest";

import { fetchNflOdds } from "./provider";

describe("fetchNflOdds", () => {
  it("requests both US regions and parses quota headers", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      expect(String(input)).toContain("regions=us%2Cus2");
      expect(String(input)).toContain("markets=spreads%2Ctotals");
      expect(String(input)).toContain(
        "commenceTimeFrom=2026-09-10T00%3A00%3A00Z",
      );
      expect(String(input)).toContain(
        "commenceTimeTo=2026-09-15T00%3A00%3A00Z",
      );
      return new Response("[]", {
        status: 200,
        headers: { "x-requests-remaining": "97", "x-requests-used": "3" },
      });
    });
    const result = await fetchNflOdds(
      "secret",
      {
        from: "2026-09-10T00:00:00.000Z",
        to: "2026-09-15T00:00:00.000Z",
      },
      fetcher as typeof fetch,
    );
    expect(result.events).toEqual([]);
    expect(result.quota.remaining).toBe(97);
  });
  it("rejects malformed provider data", async () => {
    const fetcher = vi.fn(
      async () => new Response('[{"id":"bad"}]', { status: 200 }),
    );
    await expect(
      fetchNflOdds("secret", undefined, fetcher as typeof fetch),
    ).rejects.toThrow();
  });
});
