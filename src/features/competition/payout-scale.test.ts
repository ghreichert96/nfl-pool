import { describe, expect, it } from "vitest";

import { generatePayoutScale, payoutMaximumRange } from "./payout-scale";

describe("payout scale", () => {
  it("generates the exact symmetric 16-entry ±$350 scale", () => {
    expect(generatePayoutScale(16, 350).map((row) => row.amount)).toEqual([
      350, 300, 250, 200, 150, 100, 50, 0, 0, -50, -100, -150, -200, -250, -300,
      -350,
    ]);
  });

  it("uses one middle zero for odd fields and remains balanced", () => {
    const amounts = generatePayoutScale(13, 250).map((row) => row.amount);
    expect(amounts).toHaveLength(13);
    expect(amounts.filter((amount) => amount === 0)).toHaveLength(1);
    expect(amounts.reduce((sum, amount) => sum + amount, 0)).toBe(0);
  });

  it("rejects maxima that cannot reach zero with $25/$50 steps", () => {
    expect(payoutMaximumRange(16)).toEqual({ min: 175, max: 350 });
    expect(() => generatePayoutScale(16, 375)).toThrow(/increment/);
    expect(() => generatePayoutScale(16, 340)).toThrow(/increment/);
  });
});
