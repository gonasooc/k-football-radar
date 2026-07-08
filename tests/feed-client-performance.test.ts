import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const feedClientSource = readFileSync(
  new URL("../components/FeedClient.tsx", import.meta.url),
  "utf8"
);
const filterSource = readFileSync(new URL("../lib/filter.ts", import.meta.url), "utf8");

describe("FeedClient performance", () => {
  it("debounces search and limits rendered feed items", () => {
    assert.match(feedClientSource, /SEARCH_DEBOUNCE_MS = 250/);
    assert.match(feedClientSource, /window\.setTimeout/);
    assert.match(feedClientSource, /setQuery\(searchInput\)/);
    assert.match(feedClientSource, /window\.clearTimeout/);

    assert.match(feedClientSource, /FEED_PAGE_SIZE = 30/);
    assert.match(feedClientSource, /visibleItems/);
    assert.match(feedClientSource, /setVisibleCount/);
    assert.match(feedClientSource, /더보기/);
    assert.match(feedClientSource, /MemoizedItemCard/);
  });

  it("avoids building search text until cheap filters pass", () => {
    assert.match(filterSource, /if \(filters\.type !== "all"/);
    assert.match(filterSource, /if \(filters\.issueId !== "all"/);
    assert.match(filterSource, /if \(filters\.personId !== "all"/);
    assert.ok(filterSource.includes("if (normalizedQuery.length === 0) {\n      return true;"));
    assert.match(filterSource, /return searchText\.includes\(normalizedQuery\)/);
  });
});
