import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { radarItemSchema } from "../lib/schema";

const validRadarItem = {
  id: "item_ok",
  type: "news",
  title: "뉴스",
  summary: "짧은 설명",
  url: "https://example.com/news",
  originalUrl: "https://example.com/news",
  publisher: "테스트뉴스",
  publishedAt: "2026-07-07T00:00:00.000Z",
  collectedAt: "2026-07-07T00:00:00.000Z",
  matchedKeywords: ["대한축구협회"],
  issueTags: [],
  personTags: [],
  sourceType: "news",
  isOfficial: false,
  relevanceScore: 10
} as const;

describe("radarItemSchema", () => {
  it("rejects non-http original links", () => {
    const result = radarItemSchema.safeParse({
      ...validRadarItem,
      url: "javascript:void(0);",
      originalUrl: "javascript:void(0);",
      type: "official",
      sourceType: "official",
      isOfficial: true
    });

    assert.equal(result.success, false);
  });

  it("accepts primary-compatible items and secondary relevance tiers", () => {
    assert.equal(radarItemSchema.safeParse(validRadarItem).success, true);
    assert.equal(
      radarItemSchema.safeParse({
        ...validRadarItem,
        relevanceTier: "secondary"
      }).success,
      true
    );
  });

  it("keeps discovery queries separate from semantic keyword matches", () => {
    const parsed = radarItemSchema.parse({
      ...validRadarItem,
      matchedKeywords: ["대한축구협회"],
      discoveryQueries: ["축구협회 회장 선거"]
    });

    assert.deepEqual(parsed.matchedKeywords, ["대한축구협회"]);
    assert.deepEqual(parsed.discoveryQueries, ["축구협회 회장 선거"]);
  });

  it("rejects unknown relevance tiers", () => {
    assert.equal(
      radarItemSchema.safeParse({
        ...validRadarItem,
        relevanceTier: "tertiary"
      }).success,
      false
    );
  });
});
