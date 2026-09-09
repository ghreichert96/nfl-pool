import { describe, expect, it } from "vitest";

import { normalizePhone, phoneSchema, sanitizePhoneInput } from "./phone";

describe("phone normalization", () => {
  it.each([
    ["4344090768", "+14344090768"],
    ["(434) 409-0768", "+14344090768"],
    ["1-434-409-0768", "+14344090768"],
    ["+1 (434) 409-0768", "+14344090768"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
    expect(phoneSchema.parse(input)).toBe(expected);
  });

  it("rejects incomplete numbers", () => {
    expect(phoneSchema.safeParse("434-409").success).toBe(false);
  });

  it("adds the US country code while typing", () => {
    expect(sanitizePhoneInput("(434) 409-0768")).toBe("+14344090768");
  });
});
