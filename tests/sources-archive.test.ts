import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getFeedRequestSearchParams } from "../lib/feed-page";
import { defaultFeedFilters, type FeedItem } from "../lib/filter";
import { getSourceLinkPage } from "../lib/source-link-page";

function item(index: number): FeedItem {
  return {
    id: `item-${index}`,
    title: `기사 ${index}`,
    summary: `요약 ${index}`,
    url: `https://example.com/${index}`,
    publisher: `발행처 ${index % 4}`,
    publishedAt: new Date(Date.UTC(2026, 6, 13, 0, index)).toISOString(),
    collectedAt: new Date(Date.UTC(2026, 6, 13, 1, index)).toISOString(),
    issueTags: [],
    personTags: [],
    sourceType: "news",
    relevanceScore: index,
    relevanceTier: index % 3 === 0 ? "secondary" : "primary",
    labels: ["테스트"],
    searchTerms: "테스트"
  };
}

describe("Sources archive pagination", () => {
  it("serializes only the first 30 raw source links and their required fields", () => {
    const items = Array.from({ length: 75 }, (_, index) => item(index));
    const filters = { ...defaultFeedFilters, scope: "all" as const };
    const sourceLinkPage = getSourceLinkPage(items, filters, {
      snapshot: "source-snapshot"
    });

    assert.equal(sourceLinkPage.items.length, 30);
    assert.equal(sourceLinkPage.total, 75);
    assert.equal(sourceLinkPage.hasMore, true);
    assert.equal(sourceLinkPage.snapshot, "source-snapshot");
    assert.deepEqual(Object.keys(sourceLinkPage.items[0] ?? {}).sort(), [
      "id",
      "publishedAt",
      "publisher",
      "sourceType",
      "title",
      "url"
    ]);
  });

  it("keeps raw articles separate even when the grouped feed would merge them", () => {
    const items = [item(1), item(2)];
    const page = getSourceLinkPage(
      items,
      { ...defaultFeedFilters, scope: "all" },
      { snapshot: "source-snapshot" }
    );

    assert.equal(page.total, 2);
    assert.deepEqual(new Set(page.items.map((entry) => entry.id)), new Set(["item-1", "item-2"]));
  });

  it("requests later source links with the all-items scope and a stable raw offset", () => {
    const items = Array.from({ length: 75 }, (_, index) => item(index));
    const filters = { ...defaultFeedFilters, scope: "all" as const };
    const initialPage = getSourceLinkPage(items, filters, {
      snapshot: "source-snapshot"
    });
    const params = getFeedRequestSearchParams(filters, {
      offset: initialPage.items.length,
      snapshot: initialPage.snapshot
    });
    const nextPage = getSourceLinkPage(items, filters, {
      offset: initialPage.items.length,
      snapshot: initialPage.snapshot
    });

    assert.equal(params.toString(), "scope=all&offset=30&snapshot=source-snapshot");
    assert.equal(nextPage.items.length, 30);
    assert.equal(nextPage.offset, 30);
    assert.equal(nextPage.total, 75);
    assert.equal(
      initialPage.items.some((initialItem) =>
        nextPage.items.some((nextItem) => nextItem.id === initialItem.id)
      ),
      false
    );
  });
});
