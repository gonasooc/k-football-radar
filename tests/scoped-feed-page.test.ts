import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FeedItem } from "../lib/filter";
import { getInitialScopedFeedPage } from "../lib/scoped-feed-page";

function item(index: number): FeedItem {
  return {
    id: `item-${index}`,
    title: `기사 ${index}`,
    summary: "요약",
    url: `https://example.com/${index}`,
    publisher: "테스트뉴스",
    publishedAt: new Date(Date.UTC(2026, 6, 13, 0, index)).toISOString(),
    collectedAt: new Date(Date.UTC(2026, 6, 13, 1, index)).toISOString(),
    issueTags: index < 58 ? ["issue-a"] : [],
    personTags: index % 2 === 0 ? ["person-a"] : [],
    sourceType: "news",
    relevanceScore: index,
    relevanceTier: index % 3 === 0 ? "secondary" : "primary",
    labels: [],
    searchTerms: ""
  };
}

describe("Scoped detail feed pages", () => {
  it("limits an issue detail boundary to 30 entries while preserving both totals", () => {
    const items = Array.from({ length: 75 }, (_, index) => item(index));
    const { fixedFilters, initialPage } = getInitialScopedFeedPage(
      items,
      { issueId: "issue-a" },
      "issue-snapshot",
      {
        version: 1,
        clusters: [
          {
            id: "issue-story",
            seedItemId: "item-56",
            memberIds: ["item-56", "item-57"]
          }
        ]
      }
    );

    assert.equal(fixedFilters.issueId, "issue-a");
    assert.equal(fixedFilters.scope, "all");
    assert.equal(initialPage.entries.length, 30);
    assert.equal(initialPage.totalEntries, 57);
    assert.equal(initialPage.totalItems, 58);
    assert.equal(initialPage.hasMore, true);
    assert.equal(initialPage.snapshot, "issue-snapshot");
    assert.ok(
      initialPage.entries.every((entry) =>
        entry.representative.issueTags.includes("issue-a")
      )
    );
  });

  it("limits a person detail boundary without dropping secondary matches", () => {
    const items = Array.from({ length: 75 }, (_, index) => item(index));
    const { fixedFilters, initialPage } = getInitialScopedFeedPage(items, {
      personId: "person-a"
    }, "person-snapshot");

    assert.equal(fixedFilters.personId, "person-a");
    assert.equal(fixedFilters.scope, "all");
    assert.equal(initialPage.entries.length, 30);
    assert.equal(initialPage.totalEntries, 38);
    assert.equal(initialPage.totalItems, 38);
    assert.equal(initialPage.snapshot, "person-snapshot");
    assert.ok(
      initialPage.entries.some(
        (entry) => entry.representative.relevanceTier === "secondary"
      )
    );
    assert.ok(
      initialPage.entries.every((entry) =>
        entry.representative.personTags.includes("person-a")
      )
    );
  });
});
