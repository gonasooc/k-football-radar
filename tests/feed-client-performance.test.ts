import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const feedClientSource = readFileSync(
  new URL("../components/FeedClient.tsx", import.meta.url),
  "utf8"
);
const feedApiSource = readFileSync(new URL("../lib/feed-api.ts", import.meta.url), "utf8");
const filterSource = readFileSync(new URL("../lib/filter.ts", import.meta.url), "utf8");
const newsPageSource = readFileSync(new URL("../app/news/page.tsx", import.meta.url), "utf8");
const loadingSkeletonsSource = readFileSync(
  new URL("../components/LoadingSkeletons.tsx", import.meta.url),
  "utf8"
);

describe("FeedClient performance", () => {
  it("debounces search and requests bounded result pages", () => {
    assert.match(feedClientSource, /SEARCH_DEBOUNCE_MS = 250/);
    assert.match(feedClientSource, /window\.setTimeout/);
    assert.match(feedClientSource, /setQuery\(searchInput\.trim\(\)\)/);
    assert.match(feedClientSource, /window\.clearTimeout/);

    assert.match(feedClientSource, /DEFAULT_FEED_PAGE_SIZE/);
    assert.match(feedClientSource, /import \{ FeedSnapshotMismatchError, fetchFeedPage \} from "@\/lib\/feed-api"/);
    assert.match(feedApiSource, /fetchPage<FeedPage>\("\/api\/feed"/);
    assert.match(feedClientSource, /results\.entries/);
    assert.match(feedClientSource, /if \(isLoadingMore \|\| isResultsPending \|\| !results\.hasMore\)/);
    assert.match(feedClientSource, /snapshot: requestedSnapshot/);
    assert.match(feedClientSource, /loadMoreRequestId\.current !== requestId/);
    assert.match(feedClientSource, /setIsLoadingMore\(false\)/);
    assert.match(feedClientSource, /더보기/);
    assert.match(feedClientSource, /MemoizedStoryFeedEntryCard/);
    assert.match(newsPageSource, /const initialPage = getFeedPage\(/);
    assert.doesNotMatch(newsPageSource, /items=\{feedItems\}/);
  });

  it("server-renders shared filters and keeps later changes in the page URL", () => {
    assert.match(feedClientSource, /useSearchParams\(\)/);
    assert.match(feedClientSource, /lastObservedRouteFilterKey/);
    assert.match(feedClientSource, /setTypeFilter\(routeFilters\.type\)/);
    assert.match(feedClientSource, /setSearchInput\(routeFilters\.query\)/);
    assert.match(feedClientSource, /window\.history\.replaceState/);
    assert.match(feedClientSource, /initialFilters: FeedFilters/);
    assert.match(newsPageSource, /getFeedFiltersFromSearchParams\(await searchParams/);
    assert.match(newsPageSource, /initialFilters=\{initialFilters\}/);
    assert.match(newsPageSource, /snapshot: getFeedContentRevision\(data\.items, data\.storyClusters\)/);
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
    assert.match(feedClientSource, /aria-busy=\{isResultsPending \|\| isLoadingMore\}/);
    assert.match(feedClientSource, /isResultsPending \? \(\s*<FeedResultsSkeleton/);
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
