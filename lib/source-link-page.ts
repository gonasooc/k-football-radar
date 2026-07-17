import {
  DEFAULT_FEED_PAGE_SIZE,
  getFeedPagination
} from "./feed-page";
import {
  defaultFeedFilters,
  filterItems,
  type FeedFilters,
  type FeedItem
} from "./filter";

export type SourceLinkItem = Pick<
  FeedItem,
  "id" | "url" | "title" | "publisher" | "publishedAt"
>;

export type SourceLinkPage = {
  items: SourceLinkItem[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  snapshot: string;
};

export function toSourceLinkItem({
  id,
  url,
  title,
  publisher,
  publishedAt
}: FeedItem): SourceLinkItem {
  return { id, url, title, publisher, publishedAt };
}

export function getSourceLinkPage(
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
): SourceLinkPage {
  const { offset, limit } = getFeedPagination({
    offset: rawOffset,
    limit: rawLimit
  });
  const filteredItems = filterItems(items, filters);
  const pageItems = filteredItems.slice(offset, offset + limit);

  return {
    items: pageItems.map(toSourceLinkItem),
    total: filteredItems.length,
    offset,
    limit,
    hasMore: offset + pageItems.length < filteredItems.length,
    snapshot
  };
}
