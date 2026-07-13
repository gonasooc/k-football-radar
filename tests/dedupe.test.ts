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

  it("sorts significant query parameters and strips tracking parameters case-insensitively", () => {
    assert.equal(
      canonicalizeUrl("https://EXAMPLE.com/news/1?b=2&UTM_Source=x&a=1"),
      "https://example.com/news/1?a=1&b=2"
    );
  });
});

describe("dedupeItems", () => {
  it("keeps the representative semantic metadata without promoting stale URL variants", () => {
    const items = dedupeItems([
      {
        ...baseItem,
        title: "오래된 강한 제목",
        summary: "오래된 검색 스니펫",
        matchedKeywords: ["오래된 강한 근거"],
        issueTags: ["stale-issue"],
        personTags: ["stale-person"],
        relevanceScore: 90,
        discoveryQueries: ["오래된 검색"],
        labels: ["오래된 라벨"]
      },
      {
        ...baseItem,
        id: "item_later",
        title: "대표 기사 제목",
        summary: "현재 대표 검색 스니펫",
        url: "https://example.com/news/1?utm_source=naver",
        collectedAt: "2026-07-07T06:00:00.000Z",
        matchedKeywords: ["대표 기사 근거"],
        issueTags: ["current-issue"],
        personTags: [],
        relevanceScore: 30,
        relevanceTier: "secondary",
        discoveryQueries: ["현재 검색"],
        labels: ["현재 라벨"]
      },
      {
        ...baseItem,
        id: "item_middle",
        title: "중간 수집 제목",
        summary: "중간 검색 스니펫",
        collectedAt: "2026-07-07T05:45:00.000Z",
        matchedKeywords: ["후속 수집"],
        issueTags: ["middle-issue"],
        personTags: ["middle-person"],
        relevanceScore: 100,
        discoveryQueries: ["중간 검색"],
        labels: ["중간 라벨"]
      }
    ]);

    assert.equal(items.length, 1);
    assert.equal(items[0].id, "item_later");
    assert.equal(items[0].title, "대표 기사 제목");
    assert.equal(items[0].summary, "현재 대표 검색 스니펫");
    assert.equal(items[0].collectedAt, baseItem.collectedAt);
    assert.deepEqual(items[0].discoveryQueries, [
      "오래된 검색",
      "중간 검색",
      "현재 검색"
    ]);
    assert.deepEqual(
      {
        matchedKeywords: items[0].matchedKeywords,
        issueTags: items[0].issueTags,
        personTags: items[0].personTags,
        labels: items[0].labels,
        relevanceScore: items[0].relevanceScore,
        relevanceTier: items[0].relevanceTier
      },
      {
        matchedKeywords: ["대표 기사 근거"],
        issueTags: ["current-issue"],
        personTags: [],
        labels: ["현재 라벨"],
        relevanceScore: 30,
        relevanceTier: "secondary"
      }
    );
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
    assert.equal(items[0].collectedAt, baseItem.collectedAt);
  });

  it("collapses a transitive chain of URL aliases into one record", () => {
    const items = dedupeItems([
      {
        ...baseItem,
        title: "첫 번째 제목",
        url: "https://example.com/legacy",
        originalUrl: "https://example.com/a",
        matchedKeywords: ["첫 발견"]
      },
      {
        ...baseItem,
        id: "item_alias_b",
        title: "두 번째 제목",
        url: "https://example.com/a",
        originalUrl: "https://example.com/b",
        collectedAt: "2026-07-07T06:00:00.000Z",
        matchedKeywords: ["두 번째 발견"]
      },
      {
        ...baseItem,
        id: "item_alias_c",
        title: "세 번째 제목",
        url: "https://example.com/b",
        originalUrl: "https://example.com/c",
        collectedAt: "2026-07-07T07:00:00.000Z",
        matchedKeywords: ["세 번째 발견"]
      }
    ]);

    assert.equal(items.length, 1);
    assert.equal(items[0].id, "item_alias_c");
    assert.equal(items[0].collectedAt, baseItem.collectedAt);
    assert.deepEqual(items[0].matchedKeywords, ["세 번째 발견"]);
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
