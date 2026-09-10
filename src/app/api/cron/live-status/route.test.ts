import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("ESPN cron route authorization", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects an incorrect cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");
    const response = await POST(
      new Request("http://localhost/api/cron/live-status", {
        method: "POST",
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );
    expect(response.status).toBe(401);
  });
});
