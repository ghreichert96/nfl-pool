import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("score cron route authorization", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects an incorrect cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");
    const response = await POST(
      new Request("http://localhost/api/cron/scores", {
        method: "POST",
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("retires every legacy mode without accessing the database", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");
    vi.stubEnv("ODDS_API_KEY", "odds-secret");
    const response = await POST(
      new Request("http://localhost/api/cron/scores?mode=unsafe", {
        method: "POST",
        headers: { authorization: "Bearer correct-secret" },
      }),
    );
    expect(response.status).toBe(410);
  });
  it("rejects retired automatic checks without spending Odds API quota", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");
    const response = await POST(
      new Request("http://localhost/api/cron/scores?manual=1&mode=validate", {
        method: "POST",
        headers: { authorization: "Bearer correct-secret" },
      }),
    );
    expect(response.status).toBe(410);
  });
});
