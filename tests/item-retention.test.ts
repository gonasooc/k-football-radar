import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_ITEM_RETENTION_DAYS,
  DEFAULT_MAX_RETAINED_ITEMS,
  applyItemRetentionPolicy,
  getItemRetentionDays,
  getMaxRetainedItems,
  isPublishedAtWithinRetention
} from "../lib/item-retention";
import type { RadarItem } from "../lib/schema";

function item(id: string, publishedAt: string): RadarItem {
  return {
    id,
    type: "news",
    title: id,
    summary: "짧은 설명",
    url: `https://example.com/${id}`,
    originalUrl: `https://example.com/${id}`,
    publisher: "테스트뉴스",
    publishedAt,
    collectedAt: "2026-07-09T08:10:00.000Z",
    matchedKeywords: ["대한축구협회"],
    issueTags: [],
    personTags: [],
    sourceType: "news",
    isOfficial: false,
    relevanceScore: 10
  };
}

describe("item retention", () => {
  it("uses bounded defaults for retention settings", () => {
    assert.equal(getItemRetentionDays(undefined), DEFAULT_ITEM_RETENTION_DAYS);
    assert.equal(getItemRetentionDays("30"), 30);
    assert.equal(getItemRetentionDays("0"), DEFAULT_ITEM_RETENTION_DAYS);
    assert.equal(getItemRetentionDays("99999"), DEFAULT_ITEM_RETENTION_DAYS);
    assert.equal(getMaxRetainedItems(undefined), DEFAULT_MAX_RETAINED_ITEMS);
    assert.equal(getMaxRetainedItems("500"), 500);
    assert.equal(getMaxRetainedItems("0"), DEFAULT_MAX_RETAINED_ITEMS);
  });

  it("keeps only items inside the published date window", () => {
    const now = new Date("2026-07-09T00:00:00.000Z");

    assert.equal(
      isPublishedAtWithinRetention({
        publishedAt: "2026-04-10T00:00:00.000Z",
        now,
        retentionDays: 90
      }),
      true
    );
    assert.equal(
      isPublishedAtWithinRetention({
        publishedAt: "2026-04-09T23:59:59.999Z",
        now,
        retentionDays: 90
      }),
      false
    );
  });

  it("applies the retention window before the max item cap", () => {
    const retained = applyItemRetentionPolicy(
      [
        item("old", "2026-04-01T00:00:00.000Z"),
        item("newest", "2026-07-09T00:00:00.000Z"),
        item("middle", "2026-07-08T00:00:00.000Z"),
        item("oldest-retained", "2026-07-07T00:00:00.000Z")
      ],
      {
        now: new Date("2026-07-09T00:00:00.000Z"),
        retentionDays: 90,
        maxItems: 2
      }
    );

    assert.deepEqual(
      retained.map((record) => record.id),
      ["newest", "middle"]
    );
  });
});
