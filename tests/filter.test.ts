import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { filterItems } from "../lib/filter";
import type { RadarItem } from "../lib/schema";

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

describe("filterItems", () => {
  it("filters by source type, issue, person, and keyword query", () => {
    const items = [
      item("official-election", {
        type: "official",
        sourceType: "official",
        isOfficial: true,
        title: "선거인단 공식 공지",
        issueTags: ["election"],
        personTags: ["person_a"],
        matchedKeywords: ["선거인단"]
      }),
      item("news-audit", {
        title: "문체부 감사 뉴스",
        issueTags: ["audit"],
        personTags: ["person_b"],
        matchedKeywords: ["감사"]
      })
    ];

    const filtered = filterItems(items, {
      type: "official",
      issueId: "election",
      personId: "person_a",
      query: "선거인단"
    });

    assert.deepEqual(
      filtered.map((result) => result.id),
      ["official-election"]
    );
  });
});
