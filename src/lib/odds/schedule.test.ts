import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/odds-ingestion.yml", "utf8");
const script = workflow
  .split("        run: |\n")[1]
  .split("      - name:")[0]
  .split("\n")
  .map((line) => line.replace(/^          /, ""))
  .join("\n");

it.each([
  ["workflow_dispatch", "", "finalize", "finalize"],
  ["workflow_dispatch", "", "initialize", "initialize"],
  ["workflow_dispatch", "", "refresh", "refresh"],
])(
  "selects ingestion from %s %s regardless of runner time",
  (event, schedule, manual, expected) => {
    const dir = mkdtempSync(join(tmpdir(), "odds-schedule-"));
    const output = join(dir, "output");
    try {
      const result = spawnSync(
        "bash",
        ["-e", "-c", `date() { return 99; };\n${script}`],
        {
          env: {
            ...process.env,
            EVENT_NAME: event,
            SCHEDULE: schedule,
            MANUAL_MODE: manual,
            GITHUB_OUTPUT: output,
          },
          encoding: "utf8",
        },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(output, "utf8")).toBe(`run=true\nmode=${expected}\n`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

it("has no automatic GitHub odds schedule", () => {
  expect(workflow).not.toMatch(/^  schedule:/m);
});
