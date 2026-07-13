import {
  defaultFeedFilters,
  filterItems,
  type FeedFilters,
  type FeedItem
} from "./filter";

export const DEFAULT_FEED_PAGE_SIZE = 30;
export const MAX_FEED_PAGE_SIZE = 100;

export type FeedPage = {
  items: FeedItem[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  snapshot: string;
};

type FeedPagination = {
  offset: number;
  limit: number;
};

function boundedWholeInteger(
  value: string | number | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value === "string" && !/^(0|[1-9]\d*)$/.test(value)) {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function getFeedPagination({
  offset: rawOffset = 0,
  limit: rawLimit = DEFAULT_FEED_PAGE_SIZE
}: {
  offset?: string | number;
  limit?: string | number;
} = {}): FeedPagination {
  return {
    offset: boundedWholeInteger(rawOffset, 0, 0, Number.MAX_SAFE_INTEGER),
    limit: boundedWholeInteger(
      rawLimit,
      DEFAULT_FEED_PAGE_SIZE,
      1,
      MAX_FEED_PAGE_SIZE
    )
  };
}

export function hasFeedSnapshotMismatch(
  requestedSnapshot: string | undefined,
  currentSnapshot: string,
  offset: number
): boolean {
  return offset > 0 && requestedSnapshot !== currentSnapshot;
}

export function getFeedPage(
  items: FeedItem[],
  filters: FeedFilters = defaultFeedFilters,
  {
    offset: rawOffset = 0,
    limit: rawLimit = DEFAULT_FEED_PAGE_SIZE,
    snapshot = ""
  }: {
    offset?: string | number;
    limit?: string | number;
    snapshot?: string;
  } = {}
): FeedPage {
  const { offset, limit } = getFeedPagination({
    offset: rawOffset,
    limit: rawLimit
  });
  const filteredItems = filterItems(items, filters);
  const pageItems = filteredItems.slice(offset, offset + limit);

  return {
    items: pageItems,
    total: filteredItems.length,
    offset,
    limit,
    hasMore: offset + pageItems.length < filteredItems.length,
    snapshot
  };
}

export function getFeedRequestSearchParams(
  filters: FeedFilters,
  {
    offset = 0,
    limit = DEFAULT_FEED_PAGE_SIZE,
    snapshot
  }: {
    offset?: number;
    limit?: number;
    snapshot?: string;
  } = {}
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.type !== defaultFeedFilters.type) params.set("type", filters.type);
  if (filters.scope !== defaultFeedFilters.scope) params.set("scope", filters.scope);
  if (filters.sort !== defaultFeedFilters.sort) params.set("sort", filters.sort);
  if (filters.issueId !== defaultFeedFilters.issueId) params.set("issue", filters.issueId);
  if (filters.personId !== defaultFeedFilters.personId) params.set("person", filters.personId);
  if (filters.query) params.set("q", filters.query);
  if (offset > 0) params.set("offset", String(offset));
  if (limit !== DEFAULT_FEED_PAGE_SIZE) params.set("limit", String(limit));
  if (snapshot) params.set("snapshot", snapshot);

  return params;
}
