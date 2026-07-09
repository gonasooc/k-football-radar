import type { RadarItem } from "./schema";

export type FeedTypeFilter = "all" | "news" | "official";
export type FeedScopeFilter = "primary" | "all";
export type FeedSortOrder = "latest" | "relevance";

export type FeedFilters = {
  type: FeedTypeFilter;
  scope: FeedScopeFilter;
  sort: FeedSortOrder;
  issueId: string;
  personId: string;
  query: string;
};

function isSecondaryItem(item: RadarItem): boolean {
  return item.relevanceTier === "secondary";
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareByLatest(previous: RadarItem, next: RadarItem): number {
  return (
    timestamp(next.publishedAt) - timestamp(previous.publishedAt) ||
    timestamp(next.collectedAt) - timestamp(previous.collectedAt) ||
    next.relevanceScore - previous.relevanceScore
  );
}

function compareByRelevance(previous: RadarItem, next: RadarItem): number {
  return next.relevanceScore - previous.relevanceScore || compareByLatest(previous, next);
}

export function filterItems(items: RadarItem[], filters: FeedFilters): RadarItem[] {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase("ko-KR");

  const filteredItems = items.filter((item) => {
    if (filters.scope === "primary" && normalizedQuery.length === 0 && isSecondaryItem(item)) {
      return false;
    }

    if (filters.type !== "all" && item.sourceType !== filters.type) {
      return false;
    }

    if (filters.issueId !== "all" && !item.issueTags.includes(filters.issueId)) {
      return false;
    }

    if (filters.personId !== "all" && !item.personTags.includes(filters.personId)) {
      return false;
    }

    if (normalizedQuery.length === 0) {
      return true;
    }

    const searchText = [
      item.title,
      item.summary,
      item.publisher,
      ...item.matchedKeywords,
      ...(item.labels?.filter((label) => label !== "자동 수집") ?? [])
    ]
      .join(" ")
      .toLocaleLowerCase("ko-KR");

    return searchText.includes(normalizedQuery);
  });

  return filteredItems.sort(
    filters.sort === "relevance" ? compareByRelevance : compareByLatest
  );
}
