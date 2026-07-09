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
