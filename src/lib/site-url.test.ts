import { afterEach, describe, expect, it } from "vitest";

import { getAppOrigin } from "./site-url";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe("getAppOrigin", () => {
  it("accepts the local development server on port 3000", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getAppOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    expect(getAppOrigin("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
  });

  it("prefers the configured production origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://nfl-pool-three.vercel.app/";
    expect(getAppOrigin("http://localhost:3000")).toBe(
      "https://nfl-pool-three.vercel.app",
    );
  });
});
