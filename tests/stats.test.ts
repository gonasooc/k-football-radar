import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getDashboardStats } from "../lib/stats";
import type { CollectionState, RadarItem } from "../lib/schema";

const state: CollectionState = {
  lastCollectedAt: "2026-07-07T09:00:00.000Z",
  lastRunStatus: "success",
  lastRunNewItems: 2,
  totalItems: 3
};

function item(id: string, override: Partial<RadarItem>): RadarItem {
  return {
    id,
    type: "news",
    title: id,
    summary: "짧은 설명",
    url: `https://example.com/${id}`,
    originalUrl: `https://example.com/${id}`,
    publisher: "테스트뉴스",
    publishedAt: "2026-07-07T08:00:00.000Z",
    collectedAt: "2026-07-07T08:10:00.000Z",
    matchedKeywords: [],
    issueTags: [],
    personTags: [],
    sourceType: "news",
    isOfficial: false,
    relevanceScore: 10,
    ...override
  };
}

describe("getDashboardStats", () => {
  it("counts recent item totals for the home index", () => {
    const stats = getDashboardStats({
      items: [
        item("old", {
          collectedAt: "2026-07-05T08:10:00.000Z",
          issueTags: ["audit"]
        }),
        item("news", {
          issueTags: ["election"],
          personTags: ["person_a"],
          collectedAt: "2026-07-07T08:10:00.000Z"
        }),
        item("official", {
          type: "official",
          sourceType: "official",
          isOfficial: true,
          issueTags: ["election", "audit"],
          collectedAt: "2026-07-07T07:10:00.000Z"
        })
      ],
      collectionState: state,
      now: new Date("2026-07-07T09:00:00.000Z")
    });

    assert.equal(stats.newItems24h, 2);
    assert.equal(stats.newsItems24h, 1);
    assert.equal(stats.officialItems24h, 1);
    assert.equal(stats.totalItems, 3);
  });
});
