import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { evaluateReadiness } from "../lib/readiness";

describe("evaluateReadiness", () => {
  it("marks Naver secrets as missing when external state is absent", () => {
    const report = evaluateReadiness({
      secretNames: [],
      variableNames: [],
      latestCiConclusion: "success",
      latestCollectConclusion: "success",
      latestYouTubeCollectConclusion: "success"
    });

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

  it("passes when secrets, CI, and collect workflow evidence exist", () => {
    const report = evaluateReadiness({
      secretNames: [
        "NAVER_CLIENT_ID",
        "NAVER_CLIENT_SECRET",
        "YOUTUBE_API_KEY",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY"
      ],
      variableNames: ["CLOUDFLARE_ACCOUNT_ID", "R2_BUCKET_NAME"],
      latestCiConclusion: "success",
      latestCollectConclusion: "success",
      latestYouTubeCollectConclusion: "success"
    });

    assert.equal(report.ready, true);
    assert.deepEqual(
      report.checks.map((check) => check.status),
      [
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass",
        "pass"
      ]
    );
  });

  it("fails readiness when the YouTube workflow has not succeeded", () => {
    const report = evaluateReadiness({
      secretNames: [
        "NAVER_CLIENT_ID",
        "NAVER_CLIENT_SECRET",
        "YOUTUBE_API_KEY",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY"
      ],
      variableNames: ["CLOUDFLARE_ACCOUNT_ID", "R2_BUCKET_NAME"],
      latestCiConclusion: "success",
      latestCollectConclusion: "success",
      latestYouTubeCollectConclusion: "unknown"
    });

    assert.equal(report.ready, false);
    assert.deepEqual(
      report.checks.filter((check) => check.status === "fail").map((check) => check.id),
      ["youtube-collect-workflow"]
    );
  });
});
