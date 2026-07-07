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
    const matchesType = filters.type === "all" || item.sourceType === filters.type;
    const matchesIssue = filters.issueId === "all" || item.issueTags.includes(filters.issueId);
    const matchesPerson =
      filters.personId === "all" || item.personTags.includes(filters.personId);
    const searchText = [
      item.title,
      item.summary,
      item.publisher,
      ...item.matchedKeywords,
      ...(item.labels ?? [])
    ]
      .join(" ")
      .toLocaleLowerCase("ko-KR");
    const matchesQuery = normalizedQuery.length === 0 || searchText.includes(normalizedQuery);

    return matchesType && matchesIssue && matchesPerson && matchesQuery;
  });
}
