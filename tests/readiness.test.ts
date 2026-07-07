import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { evaluateReadiness } from "../lib/readiness";

describe("evaluateReadiness", () => {
  it("marks Naver secrets and deployment as missing when external state is absent", () => {
    const report = evaluateReadiness({
      secretNames: [],
      deploymentCount: 0,
      latestCiConclusion: "success",
      latestCollectConclusion: "success"
    });

    assert.equal(report.ready, false);
    assert.deepEqual(
      report.checks
        .filter((check) => check.status === "fail")
        .map((check) => check.id),
      ["naver-client-id", "naver-client-secret", "vercel-deployment"]
    );
  });

  it("passes when secrets, deployment, CI, and collect workflow evidence exist", () => {
    const report = evaluateReadiness({
      secretNames: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"],
      deploymentCount: 1,
      latestCiConclusion: "success",
      latestCollectConclusion: "success"
    });

    assert.equal(report.ready, true);
    assert.deepEqual(
      report.checks.map((check) => check.status),
      ["pass", "pass", "pass", "pass", "pass"]
    );
  });
});
