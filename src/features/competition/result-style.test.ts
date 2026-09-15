import { describe, expect, it } from "vitest";

import { resultVisualClass } from "./result-style";

describe("resultVisualClass", () => {
  it("uses translucent gold-trimmed live colors and stronger final colors", () => {
    expect(resultVisualClass("live", "win")).toContain("border-amber-400");
    expect(resultVisualClass("live", "win")).toContain("bg-emerald-950/45");
    expect(resultVisualClass("final", "win")).toContain("bg-emerald-900/90");
    expect(resultVisualClass("final", "loss")).toContain("border-red-800");
    expect(resultVisualClass("final", "tie")).toContain("bg-slate-800/90");
  });
});
