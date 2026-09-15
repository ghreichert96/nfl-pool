import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("odds cron route authorization", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects an incorrect cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");
    const response = await POST(
      new Request("http://localhost/api/cron/odds", {
        method: "POST",
        headers: { authorization: "Bearer incorrect-secret" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects an unsupported ingestion mode", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");
    const response = await POST(
      new Request("http://localhost/api/cron/odds?mode=tomorrow", {
        method: "POST",
        headers: { authorization: "Bearer correct-secret" },
      }),
    );
    expect(response.status).toBe(400);
  });
});
