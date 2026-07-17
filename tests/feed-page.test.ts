import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_FEED_PAGE_SIZE,
  getFeedPage,
  getFeedPagination,
  getFeedRequestSearchParams,
  hasFeedSnapshotMismatch,
  MAX_FEED_PAGE_SIZE
} from "../lib/feed-page";
import { defaultFeedFilters, type FeedItem } from "../lib/filter";
import type { StoryClusterFile } from "../lib/schema";

function item(
  index: number,
  overrides: Partial<FeedItem> = {}
): FeedItem {
  return {
    id: `item-${index}`,
    title: `기사 ${index}`,
    summary: "기사 요약입니다.",
    url: `https://example.com/${index}`,
    publisher: "테스트뉴스",
    publishedAt: new Date(Date.UTC(2026, 6, 13, 0, index)).toISOString(),
    collectedAt: new Date(Date.UTC(2026, 6, 13, 1, index)).toISOString(),
    issueTags: index % 2 === 0 ? ["election"] : [],
    personTags: [],
    sourceType: "news",
    relevanceScore: index,
    relevanceTier: "primary",
    labels: [],
    searchTerms: index % 2 === 0 ? "선거" : "",
    ...overrides
  };
}

function clusters(
  definitions: Array<{ id: string; memberIds: string[] }>
): StoryClusterFile {
  return {
    version: 1,
    clusters: definitions.map(({ id, memberIds }) => ({
      id,
      seedItemId: memberIds[0]!,
      memberIds
    }))
  };
}

describe("feed pagination", () => {
  it("groups filtered news before applying entry-based pagination", () => {
    const items = Array.from({ length: 75 }, (_, index) => item(index));
    const storyClusters = clusters([
      { id: "story-even", memberIds: ["item-70", "item-72", "item-74"] }
    ]);
    const page = getFeedPage(
      items,
      { ...defaultFeedFilters, issueId: "election" },
      { offset: 30, storyClusters }
    );

    assert.equal(page.entries.length, 6);
    assert.equal(page.totalEntries, 36);
    assert.equal(page.totalItems, 38);
    assert.equal(page.offset, 30);
    assert.equal(page.limit, DEFAULT_FEED_PAGE_SIZE);
    assert.equal(page.hasMore, false);
    assert.equal(
      page.entries.reduce((total, entry) => total + entry.itemCount, 0),
      6
    );
  });

  it("keeps an entire story on one page boundary", () => {
    const items = [item(0), item(1), item(2)];
    const storyClusters = clusters([
      { id: "story-a", memberIds: ["item-1", "item-2"] }
    ]);

    const first = getFeedPage(items, defaultFeedFilters, {
      limit: 1,
      storyClusters
    });
    const second = getFeedPage(items, defaultFeedFilters, {
      offset: 1,
      limit: 1,
      storyClusters
    });

    assert.equal(first.entries.length, 1);
    assert.equal(first.entries[0]?.id, "story-a");
    assert.equal(first.entries[0]?.itemCount, 2);
    assert.equal(second.entries[0]?.id, "item-0");
    assert.equal(first.totalEntries, 2);
    assert.equal(first.totalItems, 3);
  });

  it("filters members before grouping and only exposes matching related news", () => {
    const items = [
      item(1, { title: "감독 선임 첫 보도", searchTerms: "감독" }),
      item(2, { title: "감독 선임 후속 보도", searchTerms: "감독" }),
      item(3, { title: "선수 부상 소식", searchTerms: "부상" })
    ];
    const storyClusters = clusters([
      { id: "story-a", memberIds: ["item-1", "item-2", "item-3"] }
    ]);
    const page = getFeedPage(
      items,
      { ...defaultFeedFilters, query: "감독" },
      { storyClusters }
    );

    assert.equal(page.totalEntries, 1);
    assert.equal(page.totalItems, 2);
    assert.equal(page.entries[0]?.itemCount, 2);
    assert.deepEqual(
      new Set([
        page.entries[0]?.representative.id,
        ...(page.entries[0]?.related.map((related) => related.id) ?? [])
      ]),
      new Set(["item-1", "item-2"])
    );
  });

  it("uses non-secondary items as the representative hard gate", () => {
    const primary = item(1, {
      relevanceTier: undefined,
      relevanceScore: 1,
      title: "짧은 제목...",
      summary: "짧음"
    });
    const secondary = item(2, {
      relevanceTier: "secondary",
      relevanceScore: 100,
      title: "사건을 충실하게 설명한 완전한 제목",
      summary: "사건을 충실하게 설명한 완전한 제목과 상세한 맥락을 충분한 길이로 전하는 기사 요약입니다.".repeat(3)
    });
    const page = getFeedPage(
      [primary, secondary],
      { ...defaultFeedFilters, scope: "all" },
      {
        storyClusters: clusters([
          { id: "story-a", memberIds: [primary.id, secondary.id] }
        ])
      }
    );

    assert.equal(page.entries[0]?.representative.id, primary.id);
    assert.equal(page.entries[0]?.related[0]?.id, secondary.id);
  });

  it("sorts related news newest first and stories by their aggregates", () => {
    const olderHigh = item(1, {
      publishedAt: "2026-07-10T00:00:00.000Z",
      relevanceScore: 99
    });
    const newerLow = item(2, {
      publishedAt: "2026-07-12T00:00:00.000Z",
      relevanceScore: 5
    });
    const newestMiddle = item(3, {
      publishedAt: "2026-07-13T00:00:00.000Z",
      relevanceScore: 50
    });
    const storyClusters = clusters([
      { id: "story-a", memberIds: [olderHigh.id, newerLow.id] }
    ]);

    const latest = getFeedPage(
      [olderHigh, newerLow, newestMiddle],
      { ...defaultFeedFilters, scope: "all" },
      { storyClusters }
    );
    const relevant = getFeedPage(
      [olderHigh, newerLow, newestMiddle],
      { ...defaultFeedFilters, scope: "all", sort: "relevance" },
      { storyClusters }
    );

    assert.deepEqual(latest.entries.map((entry) => entry.id), ["item-3", "story-a"]);
    assert.deepEqual(relevant.entries.map((entry) => entry.id), ["story-a", "item-3"]);
    assert.equal(relevant.entries[0]?.maxRelevanceScore, 99);
    const story = latest.entries.find((entry) => entry.id === "story-a");
    assert.equal(story?.latestPublishedAt, newerLow.publishedAt);
    assert.ok(story?.related.every((related) => related.id !== story.representative.id));
  });

  it("always leaves official material as a singleton", () => {
    const news = item(1);
    const official = item(2, { sourceType: "official" });
    const page = getFeedPage([news, official], defaultFeedFilters, {
      storyClusters: clusters([
        { id: "invalid-story", memberIds: [news.id, official.id] }
      ])
    });

    assert.equal(page.totalEntries, 2);
    assert.equal(page.entries.find((entry) => entry.id === official.id)?.itemCount, 1);
  });

  it("rejects unbounded or malformed pagination inputs", () => {
    const items = Array.from({ length: 150 }, (_, index) => item(index));
    const page = getFeedPage(items, defaultFeedFilters, {
      offset: "invalid",
      limit: MAX_FEED_PAGE_SIZE + 1
    });

    assert.equal(page.offset, 0);
    assert.equal(page.limit, DEFAULT_FEED_PAGE_SIZE);
    assert.equal(page.entries.length, DEFAULT_FEED_PAGE_SIZE);
    assert.equal(page.hasMore, true);
  });

  it("accepts only canonical safe whole-number pagination values", () => {
    for (const offset of ["30items", "1.5", "1e2", " 30", "030", "-1", "9007199254740992"]) {
      assert.equal(getFeedPagination({ offset }).offset, 0, offset);
    }

    for (const limit of ["30items", "1.5", "1e2", " 30", "030", "0", 12.5]) {
      assert.equal(getFeedPagination({ limit }).limit, DEFAULT_FEED_PAGE_SIZE, String(limit));
    }

    assert.deepEqual(getFeedPagination({ offset: "30", limit: "100" }), {
      offset: 30,
      limit: 100
    });
  });

  it("requires a matching snapshot for every later page", () => {
    const currentSnapshot = "2026-07-13T01:14:31.959Z";

    assert.equal(hasFeedSnapshotMismatch(undefined, currentSnapshot, 0), false);
    assert.equal(hasFeedSnapshotMismatch(undefined, currentSnapshot, 30), true);
    assert.equal(hasFeedSnapshotMismatch("older", currentSnapshot, 30), true);
    assert.equal(hasFeedSnapshotMismatch(currentSnapshot, currentSnapshot, 30), false);
  });

  it("serializes only non-default filters and pagination state", () => {
    const params = getFeedRequestSearchParams(
      {
        ...defaultFeedFilters,
        scope: "all",
        query: "감독 선임"
      },
      { offset: 30, snapshot: "2026-07-13T01:14:31.959Z" }
    );

    assert.equal(
      params.toString(),
      "scope=all&q=%EA%B0%90%EB%8F%85+%EC%84%A0%EC%9E%84&offset=30&snapshot=2026-07-13T01%3A14%3A31.959Z"
    );
  });
});
