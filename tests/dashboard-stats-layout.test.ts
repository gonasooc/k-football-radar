import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const dashboardStatsSource = readFileSync(
  new URL("../components/DashboardStats.tsx", import.meta.url),
  "utf8"
);

describe("DashboardStats layout", () => {
  it("keeps the stats compact without a redundant label", () => {
    assert.match(dashboardStatsSource, /grid-cols-2/);
    assert.match(dashboardStatsSource, /md:grid-cols-4/);
    assert.match(dashboardStatsSource, /aria-label="수집 현황"/);
    assert.match(dashboardStatsSource, /<dl className/);
    assert.match(dashboardStatsSource, /<dt className/);
    assert.match(dashboardStatsSource, /<dd className/);
    assert.doesNotMatch(dashboardStatsSource, /레이더 인덱스/);
    assert.match(dashboardStatsSource, /px-3 py-3/);
    assert.match(dashboardStatsSource, /text-base/);
    assert.doesNotMatch(dashboardStatsSource, /text-2xl/);
    assert.doesNotMatch(dashboardStatsSource, /sm:text-3xl/);
    assert.doesNotMatch(dashboardStatsSource, /최근 24시간 기준/);
  });
});
