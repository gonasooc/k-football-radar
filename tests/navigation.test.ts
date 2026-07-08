import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  getActiveNavItem,
  getTrackingTabFromSearchParams,
  navItems,
  trackingTabs
} from "../lib/navigation";

describe("navItems", () => {
  it("uses tracking as the single top-level entry for issues and people", () => {
    assert.deepEqual(
      navItems.map((item) => item.label),
      ["홈", "전체 기사", "트래킹", "출처"]
    );
    assert.equal(navItems.some((item) => item.href === "/issues"), false);
    assert.equal(navItems.some((item) => item.href === "/people"), false);
  });
});

describe("getActiveNavItem", () => {
  it("marks tracking active for tracking, issue detail, and person detail routes", () => {
    assert.equal(getActiveNavItem("/tracking")?.href, "/tracking");
    assert.equal(getActiveNavItem("/tracking?tab=people")?.href, "/tracking");
    assert.equal(getActiveNavItem("/issues/election")?.href, "/tracking");
    assert.equal(getActiveNavItem("/people/person_chung_mong_gyu")?.href, "/tracking");
  });
});

describe("trackingTabs", () => {
  it("keeps issues and people under the tracking page", () => {
    assert.deepEqual(
      trackingTabs.map((tab) => [tab.id, tab.label, tab.href]),
      [
        ["issues", "이슈", "/tracking"],
        ["people", "인물", "/tracking?tab=people"]
      ]
    );
  });

  it("defaults unknown tracking tab params to issues", () => {
    assert.equal(getTrackingTabFromSearchParams(undefined), "issues");
    assert.equal(getTrackingTabFromSearchParams({ tab: "people" }), "people");
    assert.equal(getTrackingTabFromSearchParams({ tab: "sources" }), "issues");
    assert.equal(getTrackingTabFromSearchParams({ tab: ["people", "issues"] }), "people");
  });
});
