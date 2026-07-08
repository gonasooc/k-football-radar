import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const dashboardStatsSource = readFileSync(
  new URL("../components/DashboardStats.tsx", import.meta.url),
  "utf8"
);

describe("DashboardStats layout", () => {
  it("keeps the radar index compact on mobile", () => {
    assert.match(dashboardStatsSource, /grid-cols-2/);
    assert.match(dashboardStatsSource, /py-2 sm:py-4/);
    assert.match(dashboardStatsSource, /px-3 py-3/);
    assert.match(dashboardStatsSource, /text-2xl/);
    assert.match(dashboardStatsSource, /sm:text-3xl/);
    assert.match(dashboardStatsSource, /hidden text-xs font-semibold text-muted sm:block/);
  });
});
