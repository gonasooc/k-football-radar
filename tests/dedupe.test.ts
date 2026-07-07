import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { canonicalizeUrl, dedupeItems, sortItemsLatestFirst } from "../lib/dedupe";
import type { RadarItem } from "../lib/schema";

const baseItem: RadarItem = {
  id: "item_base",
  type: "news",
  title: "대한축구협회 선거인단 관련 보도",
  summary: "짧은 설명",
  url: "https://example.com/news/1",
  originalUrl: "https://example.com/news/1",
  publisher: "테스트뉴스",
  publishedAt: "2026-07-07T05:00:00.000Z",
  collectedAt: "2026-07-07T05:30:00.000Z",
  matchedKeywords: ["대한축구협회"],
  issueTags: ["electoral-college"],
  personTags: [],
  sourceType: "news",
  isOfficial: false,
  relevanceScore: 50
};

describe("canonicalizeUrl", () => {
  it("normalizes tracking parameters and trailing slash", () => {
    assert.equal(
      canonicalizeUrl("https://example.com/news/1/?utm_source=x&fbclid=y"),
      "https://example.com/news/1"
    );
  });
});

describe("dedupeItems", () => {
  it("keeps the latest collected item for matching canonical URLs", () => {
    const items = dedupeItems([
      baseItem,
      {
        ...baseItem,
        id: "item_later",
        url: "https://example.com/news/1?utm_source=naver",
        collectedAt: "2026-07-07T06:00:00.000Z",
        matchedKeywords: ["대한축구협회", "선거인단"]
      }
    ]);

    assert.equal(items.length, 1);
    assert.equal(items[0].id, "item_later");
    assert.deepEqual(items[0].matchedKeywords, ["대한축구협회", "선거인단"]);
  });

  it("dedupes title, publisher, and publishedAt matches when URLs differ", () => {
    const items = dedupeItems([
      baseItem,
      {
        ...baseItem,
        id: "item_same_story",
        url: "https://m.example.com/news/1",
        originalUrl: "https://m.example.com/news/1",
        collectedAt: "2026-07-07T06:00:00.000Z"
      }
    ]);

    assert.equal(items.length, 1);
    assert.equal(items[0].id, "item_same_story");
  });
});

describe("sortItemsLatestFirst", () => {
  it("orders by published date descending", () => {
    const items = sortItemsLatestFirst([
      baseItem,
      {
        ...baseItem,
        id: "item_new",
        publishedAt: "2026-07-07T08:00:00.000Z"
      }
    ]);

    assert.deepEqual(
      items.map((item) => item.id),
      ["item_new", "item_base"]
    );
  });
});
