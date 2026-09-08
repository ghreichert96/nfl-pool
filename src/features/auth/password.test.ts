import { describe, expect, it } from "vitest";

import { passwordSchema } from "./password";

describe("passwordSchema", () => {
  it("accepts matching passwords with at least 12 characters", () => {
    expect(
      passwordSchema.safeParse({
        password: "long-enough-password",
        confirmation: "long-enough-password",
      }).success,
    ).toBe(true);
  });

  it("rejects short and mismatched passwords", () => {
    expect(
      passwordSchema.safeParse({ password: "short", confirmation: "short" })
        .success,
    ).toBe(false);
    expect(
      passwordSchema.safeParse({
        password: "long-enough-password",
        confirmation: "different-password",
      }).success,
    ).toBe(false);
  });
});
