import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { checkReadiness } from "../scripts/check-readiness";

const NOW = Date.parse("2026-10-02T12:00:00.000Z");
const CREATED_AT = "2026-10-02T11:00:00.000Z";

function configurationOutput(args: string[]): string | undefined {
  if (args[0] === "secret") {
    return [
      "NAVER_CLIENT_ID",
      "NAVER_CLIENT_SECRET",
      "YOUTUBE_API_KEY",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY"
    ].join("\n");
  }
  if (args[0] === "variable") {
    return "CLOUDFLARE_ACCOUNT_ID\nR2_BUCKET_NAME";
  }
  return undefined;
}

describe("checkReadiness", () => {
  it("uses main CI failure even when the newest PR CI succeeded", async () => {
    const workflowCalls: string[][] = [];
    const report = await checkReadiness(async (args) => {
      const config = configurationOutput(args);
      if (config !== undefined) return config;

      workflowCalls.push(args);
      const branch = args[args.indexOf("--branch") + 1];
      const workflow = args[args.indexOf("--workflow") + 1];
      return JSON.stringify([{
        conclusion: workflow === "CI" && branch === "main" ? "failure" : "success",
        createdAt: CREATED_AT
      }]);
    }, NOW);

    assert.equal(report.ready, false);
    assert.deepEqual(
      report.checks.filter((check) => check.status === "fail").map((check) => check.id),
      ["ci-workflow"]
    );
    assert.equal(workflowCalls.length, 3);
    for (const args of workflowCalls) {
      assert.equal(args[args.indexOf("--branch") + 1], "main");
      assert.equal(args[args.indexOf("--status") + 1], "completed");
      assert.equal(args[args.indexOf("--limit") + 1], "1");
      assert.equal(args[args.indexOf("--json") + 1], "conclusion,createdAt");
    }
  });

  it("passes recent main successes and fails when collection success becomes stale", async () => {
    const run = async (args: string[]) => configurationOutput(args)
      ?? JSON.stringify([{ conclusion: "success", createdAt: CREATED_AT }]);

    assert.equal((await checkReadiness(run, NOW)).ready, true);
    const report = await checkReadiness(run, NOW + 3 * 60 * 60 * 1000);
    assert.equal(report.ready, false);
    assert.deepEqual(
      report.checks.filter((check) => check.status === "fail").map((check) => check.id),
      ["collect-workflow"]
    );
  });

  it("fails workflow checks when main has no completed runs", async () => {
    const report = await checkReadiness(async (args) => configurationOutput(args) ?? "[]", NOW);

    assert.equal(report.ready, false);
    assert.deepEqual(
      report.checks.filter((check) => check.status === "fail").map((check) => check.id),
      ["ci-workflow", "collect-workflow", "youtube-collect-workflow"]
    );
  });
});
