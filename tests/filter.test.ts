import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { filterItems, getFeedFiltersFromSearchParams, toFeedItems } from "../lib/filter";
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
      scope: "primary",
      sort: "latest",
      issueId: "election",
      personId: "person_a",
      query: "선거인단"
    });

    assert.deepEqual(
      filtered.map((result) => result.id),
      ["official-election"]
    );
  });

  it("hides secondary items from the default feed but keeps them searchable", () => {
    const items = [
      item("primary-news", {
        title: "대한축구협회 청문회",
        matchedKeywords: ["대한축구협회"],
        relevanceScore: 40
      }),
      item("secondary-news", {
        title: "대한축구협회 관계자 현장 점검",
        matchedKeywords: ["대한축구협회"],
        relevanceScore: 20,
        relevanceTier: "secondary"
      })
    ];

    assert.deepEqual(
      filterItems(items, {
        type: "all",
        scope: "primary",
        sort: "latest",
        issueId: "all",
        personId: "all",
        query: ""
      }).map((result) => result.id),
      ["primary-news"]
    );

    assert.deepEqual(
      filterItems(items, {
        type: "all",
        scope: "primary",
        sort: "latest",
        issueId: "all",
        personId: "all",
        query: "현장"
      }).map((result) => result.id),
      ["secondary-news"]
    );

    assert.deepEqual(
      filterItems(items, {
        type: "all",
        scope: "all",
        sort: "latest",
        issueId: "all",
        personId: "all",
        query: ""
      }).map((result) => result.id),
      ["primary-news", "secondary-news"]
    );
  });

  it("sorts by latest publication time or relevance score", () => {
    const items = [
      item("older-high-relevance", {
        publishedAt: "2026-07-06T08:00:00.000Z",
        collectedAt: "2026-07-06T08:10:00.000Z",
        relevanceScore: 90
      }),
      item("newer-low-relevance", {
        publishedAt: "2026-07-08T08:00:00.000Z",
        collectedAt: "2026-07-08T08:10:00.000Z",
        relevanceScore: 20
      }),
      item("newest-mid-relevance", {
        publishedAt: "2026-07-09T08:00:00.000Z",
        collectedAt: "2026-07-09T08:10:00.000Z",
        relevanceScore: 50
      })
    ];

    assert.deepEqual(
      filterItems(items, {
        type: "all",
        scope: "primary",
        sort: "latest",
        issueId: "all",
        personId: "all",
        query: ""
      }).map((result) => result.id),
      ["newest-mid-relevance", "newer-low-relevance", "older-high-relevance"]
    );

    assert.deepEqual(
      filterItems(items, {
        type: "all",
        scope: "primary",
        sort: "relevance",
        issueId: "all",
        personId: "all",
        query: ""
      }).map((result) => result.id),
      ["older-high-relevance", "newest-mid-relevance", "newer-low-relevance"]
    );
  });
});

describe("getFeedFiltersFromSearchParams", () => {
  it("parses valid shareable filters and rejects unknown entity ids", () => {
    assert.deepEqual(
      getFeedFiltersFromSearchParams(
        {
          type: "official",
          scope: "all",
          sort: "relevance",
          issue: "election",
          person: "unknown",
          q: "  선거  "
        },
        {
          issueIds: new Set(["election"]),
          personIds: new Set(["person_a"])
        }
      ),
      {
        type: "official",
        scope: "all",
        sort: "relevance",
        issueId: "election",
        personId: "all",
        query: "선거"
      }
    );
  });

  it("falls back to the default filters for unsupported values", () => {
    assert.deepEqual(getFeedFiltersFromSearchParams({ type: "video", sort: "oldest" }), {
      type: "all",
      scope: "primary",
      sort: "latest",
      issueId: "all",
      personId: "all",
      query: ""
    });
  });

  it("supports a forced YouTube type while preserving shared filters", () => {
    assert.deepEqual(
      getFeedFiltersFromSearchParams(
        { type: "news", scope: "all", issue: "election", q: "선거" },
        {
          forcedType: "youtube",
          issueIds: new Set(["election"])
        }
      ),
      {
        type: "youtube",
        scope: "all",
        sort: "latest",
        issueId: "election",
        personId: "all",
        query: "선거"
      }
    );
  });
});

describe("toFeedItems", () => {
  it("projects feed fields without changing search or latest-sort behavior", () => {
    const originalItems = [
      item("feed-item", {
        labels: ["인물 언급"],
        matchedKeywords: ["대한축구협회", "대한축구협회 감독 선임", "감독 선임"]
      })
    ];
    const [feedItem] = toFeedItems(originalItems);

    assert.ok(feedItem);
    assert.equal("originalUrl" in feedItem, false);
    assert.equal("matchedKeywords" in feedItem, false);
    assert.equal(
      feedItem.searchTerms,
      "대한축구협회 대한축구협회 감독 선임 감독 선임 인물 언급"
    );

    const filters = {
      type: "all",
      scope: "primary",
      sort: "latest",
      issueId: "all",
      personId: "all",
      query: "감독 선임 인물 언급"
    } as const;

    assert.deepEqual(
      filterItems(originalItems, filters).map((result) => result.id),
      filterItems(toFeedItems(originalItems), filters).map((result) => result.id)
    );
  });
});
