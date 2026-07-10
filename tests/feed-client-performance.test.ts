import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const feedClientSource = readFileSync(
  new URL("../components/FeedClient.tsx", import.meta.url),
  "utf8"
);
const filterSource = readFileSync(new URL("../lib/filter.ts", import.meta.url), "utf8");
const loadingSkeletonsSource = readFileSync(
  new URL("../components/LoadingSkeletons.tsx", import.meta.url),
  "utf8"
);

describe("FeedClient performance", () => {
  it("debounces search and limits rendered feed items", () => {
    assert.match(feedClientSource, /SEARCH_DEBOUNCE_MS = 250/);
    assert.match(feedClientSource, /window\.setTimeout/);
    assert.match(feedClientSource, /setQuery\(searchInput\.trim\(\)\)/);
    assert.match(feedClientSource, /window\.clearTimeout/);

    assert.match(feedClientSource, /FEED_PAGE_SIZE = 30/);
    assert.match(feedClientSource, /visibleItems/);
    assert.match(feedClientSource, /setVisibleCount/);
    assert.match(feedClientSource, /더보기/);
    assert.match(feedClientSource, /MemoizedItemCard/);
  });

  it("keeps filter state shareable in the page URL", () => {
    assert.match(feedClientSource, /URLSearchParams/);
    assert.match(feedClientSource, /window\.history\.replaceState/);
    assert.match(feedClientSource, /getFeedFiltersFromSearchParams/);
    assert.match(feedClientSource, /isUrlInitialized/);
    assert.match(feedClientSource, /params\.set\("q", filters\.query\)/);
  });

  it("makes search progress visible even when the result count barely changes", () => {
    assert.match(feedClientSource, /const isSearchPending = normalizedSearchInput !== query/);
    assert.match(feedClientSource, /검색어 적용 중…/);
    assert.match(feedClientSource, /motion-safe:animate-spin/);
    assert.match(feedClientSource, /‘\{query\}’/);
    assert.match(feedClientSource, /검색 완료/);
    assert.match(feedClientSource, /aria-atomic="true"/);
    assert.match(feedClientSource, /aria-live="polite"/);
    assert.match(
      feedClientSource,
      /metric-tabular flex min-w-0 flex-wrap items-center gap-y-1.*leading-5/
    );
    assert.match(feedClientSource, /aria-busy=\{isSearchPending\}/);
    assert.match(feedClientSource, /isSearchPending \? \(\s*<FeedResultsSkeleton/);
    assert.match(loadingSkeletonsSource, /aria-hidden="true"/);
    assert.match(loadingSkeletonsSource, /data-feed-results-skeleton="true"/);
    assert.match(loadingSkeletonsSource, /motion-safe:animate-pulse/);
  });

  it("avoids building search text until cheap filters pass", () => {
    assert.match(filterSource, /if \(filters\.type !== "all"/);
    assert.match(filterSource, /if \(filters\.issueId !== "all"/);
    assert.match(filterSource, /if \(filters\.personId !== "all"/);
    assert.ok(filterSource.includes("if (normalizedQuery.length === 0) {\n      return true;"));
    assert.match(filterSource, /return searchText\.includes\(normalizedQuery\)/);
  });
});
