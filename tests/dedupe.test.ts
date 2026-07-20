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

  it("normalizes YouTube watch, short, embed, and share URLs to one video URL", () => {
    const expected = "https://www.youtube.com/watch?v=abc-123";

    assert.equal(canonicalizeUrl("https://youtu.be/abc-123?t=3"), expected);
    assert.equal(canonicalizeUrl("https://m.youtube.com/shorts/abc-123"), expected);
    assert.equal(canonicalizeUrl("https://www.youtube.com/embed/abc-123"), expected);
    assert.equal(
      canonicalizeUrl("https://www.youtube.com/watch?v=abc-123&utm_source=test"),
      expected
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

  it("keeps the earliest publication time when a re-collection stamps a newer one", () => {
    const items = dedupeItems([
      baseItem,
      {
        ...baseItem,
        id: "item_recollected",
        publishedAt: "2026-07-08T09:00:00.000Z",
        collectedAt: "2026-07-08T09:00:00.000Z"
      }
    ]);

    assert.equal(items.length, 1);
    assert.equal(items[0].id, "item_recollected");
    assert.equal(items[0].publishedAt, baseItem.publishedAt);
    assert.equal(items[0].collectedAt, baseItem.collectedAt);
  });

  it("merges a re-upload of the same report published within the window", () => {
    const items = dedupeItems([
      {
        ...baseItem,
        id: "youtube_first",
        type: "youtube",
        sourceType: "youtube",
        title: "경찰, '홍명보 논란' 사실상 재수사?...연일 관계자 소환 / YTN",
        publisher: "YTN",
        url: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
        originalUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
        publishedAt: "2026-07-18T21:31:36.000Z",
        collectedAt: "2026-07-19T03:55:51.000Z",
        youtube: {
          videoId: "aaaaaaaaaaa",
          channelId: "channel-ytn",
          thumbnail: {
            url: "https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg",
            width: 480,
            height: 360
          },
          durationSeconds: 117
        }
      },
      {
        ...baseItem,
        id: "youtube_reupload",
        type: "youtube",
        sourceType: "youtube",
        title: "경찰, '홍명보 논란' 사실상 재수사?...연일 관계자 소환 / YTN",
        publisher: "YTN",
        url: "https://www.youtube.com/watch?v=bbbbbbbbbbb",
        originalUrl: "https://www.youtube.com/watch?v=bbbbbbbbbbb",
        publishedAt: "2026-07-19T13:47:51.000Z",
        collectedAt: "2026-07-19T13:54:36.000Z",
        youtube: {
          videoId: "bbbbbbbbbbb",
          channelId: "channel-ytn",
          thumbnail: {
            url: "https://i.ytimg.com/vi/bbbbbbbbbbb/hqdefault.jpg",
            width: 480,
            height: 360
          },
          durationSeconds: 119
        }
      }
    ]);

    assert.equal(items.length, 1);
    assert.equal(items[0].id, "youtube_reupload");
    assert.equal(items[0].publishedAt, "2026-07-18T21:31:36.000Z");
  });

  it("keeps identical titles apart once they fall outside the window", () => {
    const items = dedupeItems([
      {
        ...baseItem,
        id: "item_episode_1",
        title: "주간 축구협회 브리핑",
        publishedAt: "2026-07-07T05:00:00.000Z",
        url: "https://example.com/show/1",
        originalUrl: "https://example.com/show/1"
      },
      {
        ...baseItem,
        id: "item_episode_2",
        title: "주간 축구협회 브리핑",
        publishedAt: "2026-07-09T05:00:00.000Z",
        url: "https://example.com/show/2",
        originalUrl: "https://example.com/show/2"
      }
    ]);

    assert.deepEqual(
      items.map((item) => item.id),
      ["item_episode_2", "item_episode_1"]
    );
  });

  it("bounds a run of same-titled items to one window instead of chaining", () => {
    const items = dedupeItems([
      {
        ...baseItem,
        id: "item_hour_0",
        title: "주간 축구협회 브리핑",
        publishedAt: "2026-07-07T05:00:00.000Z",
        url: "https://example.com/run/1",
        originalUrl: "https://example.com/run/1"
      },
      {
        ...baseItem,
        id: "item_hour_20",
        title: "주간 축구협회 브리핑",
        publishedAt: "2026-07-08T01:00:00.000Z",
        url: "https://example.com/run/2",
        originalUrl: "https://example.com/run/2"
      },
      {
        ...baseItem,
        id: "item_hour_40",
        title: "주간 축구협회 브리핑",
        publishedAt: "2026-07-08T21:00:00.000Z",
        url: "https://example.com/run/3",
        originalUrl: "https://example.com/run/3"
      }
    ]);

    // Each item sits 20h from its neighbour: without an anchor they would chain
    // into a single group, so the last one must stay separate from the first.
    assert.equal(items.length, 2);
    assert.ok(items.some((item) => item.id === "item_hour_40"));
  });

  it("merges the same story from one publisher when only the timestamp shifts", () => {
    const items = dedupeItems([
      {
        ...baseItem,
        id: "item_first_fetch",
        publishedAt: "2026-07-07T05:00:00.000Z",
        url: "https://example.com/news/a",
        originalUrl: "https://example.com/news/a"
      },
      {
        ...baseItem,
        id: "item_updated_fetch",
        publishedAt: "2026-07-07T09:30:00.000Z",
        collectedAt: "2026-07-07T09:40:00.000Z",
        url: "https://example.com/news/b",
        originalUrl: "https://example.com/news/b"
      }
    ]);

    assert.equal(items.length, 1);
    assert.equal(items[0].id, "item_updated_fetch");
    assert.equal(items[0].publishedAt, "2026-07-07T05:00:00.000Z");
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
