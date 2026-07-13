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

function item(index: number): FeedItem {
  return {
    id: `item-${index}`,
    title: `기사 ${index}`,
    summary: "요약",
    url: `https://example.com/${index}`,
    publisher: "테스트뉴스",
    publishedAt: new Date(Date.UTC(2026, 6, 13, 0, index)).toISOString(),
    collectedAt: new Date(Date.UTC(2026, 6, 13, 1, index)).toISOString(),
    issueTags: index % 2 === 0 ? ["election"] : [],
    personTags: [],
    sourceType: "news",
    relevanceScore: index,
    searchTerms: index % 2 === 0 ? "선거" : ""
  };
}

describe("feed pagination", () => {
  it("returns a bounded page and stable total after filtering", () => {
    const items = Array.from({ length: 75 }, (_, index) => item(index));
    const page = getFeedPage(
      items,
      { ...defaultFeedFilters, issueId: "election" },
      { offset: 30 }
    );

    assert.equal(page.items.length, 8);
    assert.equal(page.total, 38);
    assert.equal(page.offset, 30);
    assert.equal(page.limit, DEFAULT_FEED_PAGE_SIZE);
    assert.equal(page.hasMore, false);
  });

  it("rejects unbounded or malformed pagination inputs", () => {
    const items = Array.from({ length: 150 }, (_, index) => item(index));
    const page = getFeedPage(items, defaultFeedFilters, {
      offset: "invalid",
      limit: MAX_FEED_PAGE_SIZE + 1
    });

    assert.equal(page.offset, 0);
    assert.equal(page.limit, DEFAULT_FEED_PAGE_SIZE);
    assert.equal(page.items.length, DEFAULT_FEED_PAGE_SIZE);
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
