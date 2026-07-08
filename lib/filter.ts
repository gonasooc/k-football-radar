import type { RadarItem } from "./schema";

export type FeedTypeFilter = "all" | "news" | "official";

export type FeedFilters = {
  type: FeedTypeFilter;
  issueId: string;
  personId: string;
  query: string;
};

export function filterItems(items: RadarItem[], filters: FeedFilters): RadarItem[] {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase("ko-KR");

  return items.filter((item) => {
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
      ...(item.labels ?? [])
    ]
      .join(" ")
      .toLocaleLowerCase("ko-KR");

    return searchText.includes(normalizedQuery);
  });
}
