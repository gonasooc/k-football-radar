import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { evaluateReadiness, type ReadinessInput } from "../lib/readiness";

const NOW = Date.parse("2026-10-02T12:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

function readyInput(): ReadinessInput {
  return {
    secretNames: [
      "NAVER_CLIENT_ID",
      "NAVER_CLIENT_SECRET",
      "YOUTUBE_API_KEY",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY"
    ],
    variableNames: ["CLOUDFLARE_ACCOUNT_ID", "R2_BUCKET_NAME"],
    latestCiRun: { conclusion: "success", createdAt: "2026-10-01T12:00:00.000Z" },
    latestCollectRun: { conclusion: "success", createdAt: "2026-10-02T11:47:00.000Z" },
    latestYouTubeCollectRun: { conclusion: "success", createdAt: "2026-10-02T00:17:00.000Z" }
  };
}

describe("evaluateReadiness", () => {
  it("marks required configuration as missing when external state is absent", () => {
    const report = evaluateReadiness({ ...readyInput(), secretNames: [], variableNames: [] }, NOW);

    assert.equal(report.ready, false);
    assert.deepEqual(
      report.checks
        .filter((check) => check.status === "fail")
        .map((check) => check.id),
      [
        "naver-client-id",
        "naver-client-secret",
        "youtube-api-key",
        "r2-access-key-id",
        "r2-secret-access-key",
        "cloudflare-account-id",
        "r2-bucket-name"
      ]
    );
  });

  it("passes when configuration, CI, and recent collection successes exist", () => {
    const report = evaluateReadiness(readyInput(), NOW);

    assert.equal(report.ready, true);
    assert.equal(report.checks.length, 10);
    assert.ok(report.checks.every((check) => check.status === "pass"));
  });

  it("fails readiness when the YouTube workflow has not succeeded", () => {
    const report = evaluateReadiness({
      ...readyInput(),
      latestYouTubeCollectRun: { conclusion: "unknown" }
    }, NOW);

    assert.equal(report.ready, false);
    assert.deepEqual(
      report.checks.filter((check) => check.status === "fail").map((check) => check.id),
      ["youtube-collect-workflow"]
    );
  });

  for (const [field, checkId, limitHours] of [
    ["latestCollectRun", "collect-workflow", 3],
    ["latestYouTubeCollectRun", "youtube-collect-workflow", 26]
  ] as const) {
    it(`accepts ${field} at its ${limitHours}h delay boundary and fails immediately after`, () => {
      const input = readyInput();
      input[field].createdAt = new Date(NOW - limitHours * HOUR_MS).toISOString();
      assert.equal(evaluateReadiness(input, NOW).ready, true);

      const report = evaluateReadiness(input, NOW + 1);
      assert.equal(report.ready, false);
      const check = report.checks.find((entry) => entry.id === checkId);
      assert.equal(check?.status, "fail");
      assert.match(check?.detail ?? "", /too old/);
      assert.match(check?.detail ?? "", new RegExp(`limit ${limitHours}h`));
    });

    it(`fails a recent unsuccessful ${field}`, () => {
      const input = readyInput();
      input[field].conclusion = "failure";
      const report = evaluateReadiness(input, NOW);
      assert.equal(report.ready, false);
      assert.match(report.checks.find((entry) => entry.id === checkId)?.detail ?? "", /failure/);
    });
  }

  for (const field of ["latestCiRun", "latestCollectRun", "latestYouTubeCollectRun"] as const) {
    it(`rejects missing, invalid, and future timestamps for ${field}`, () => {
      for (const createdAt of [
        undefined,
        "",
        "not-a-date",
        "2026-02-30T12:00:00.000Z",
        "2026-10-02T12:00:00.000+99:99",
        new Date(NOW + 1).toISOString()
      ]) {
        const input = readyInput();
        input[field].createdAt = createdAt;
        assert.equal(evaluateReadiness(input, NOW).ready, false, `${field}: ${createdAt}`);
      }
    });
  }

  it("does not expire CI because it runs on code changes instead of a schedule", () => {
    const input = readyInput();
    input.latestCiRun.createdAt = new Date(NOW - 90 * 24 * HOUR_MS).toISOString();
    assert.equal(evaluateReadiness(input, NOW).ready, true);
  });
});
