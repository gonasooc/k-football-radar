import type { RadarItem } from "./schema";

export type FeedTypeFilter = "all" | "news" | "official" | "youtube";
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

export type FeedItem = Pick<
  RadarItem,
  | "id"
  | "title"
  | "summary"
  | "url"
  | "publisher"
  | "publishedAt"
  | "collectedAt"
  | "issueTags"
  | "personTags"
  | "sourceType"
  | "relevanceScore"
  | "relevanceTier"
  | "labels"
  | "youtube"
> & {
  searchTerms: string;
};

type FilterableFeedItem = Pick<
  RadarItem,
  | "title"
  | "summary"
  | "publisher"
  | "publishedAt"
  | "collectedAt"
  | "issueTags"
  | "personTags"
  | "sourceType"
  | "relevanceScore"
  | "relevanceTier"
> & {
  labels?: string[];
  matchedKeywords?: string[];
  searchTerms?: string;
};

export const defaultFeedFilters: FeedFilters = {
  type: "all",
  scope: "primary",
  sort: "latest",
  issueId: "all",
  personId: "all",
  query: ""
};

type FeedSearchParams = Record<string, string | string[] | undefined> | undefined;

type FeedFilterOptions = {
  issueIds?: ReadonlySet<string>;
  personIds?: ReadonlySet<string>;
  allowedTypes?: ReadonlySet<FeedTypeFilter>;
  forcedType?: FeedTypeFilter;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function getFeedFiltersFromSearchParams(
  searchParams: FeedSearchParams,
  options: FeedFilterOptions = {}
): FeedFilters {
  const typeValue = firstValue(searchParams?.type);
  const scopeValue = firstValue(searchParams?.scope);
  const sortValue = firstValue(searchParams?.sort);
  const issueValue = firstValue(searchParams?.issue);
  const personValue = firstValue(searchParams?.person);
  const queryValue = firstValue(searchParams?.q).trim().slice(0, 200);

  const parsedType: FeedTypeFilter =
    typeValue === "news" || typeValue === "official" || typeValue === "youtube"
      ? typeValue
      : "all";

  return {
    type:
      options.forcedType ??
      (options.allowedTypes && !options.allowedTypes.has(parsedType) ? "all" : parsedType),
    scope: scopeValue === "all" ? "all" : "primary",
    sort: sortValue === "relevance" ? "relevance" : "latest",
    issueId:
      issueValue && (!options.issueIds || options.issueIds.has(issueValue))
        ? issueValue
        : "all",
    personId:
      personValue && (!options.personIds || options.personIds.has(personValue))
        ? personValue
        : "all",
    query: queryValue
  };
}

function isSecondaryItem(item: FilterableFeedItem): boolean {
  return item.relevanceTier === "secondary";
}

export function toFeedItems(items: readonly RadarItem[]): FeedItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    url: item.url,
    publisher: item.publisher,
    publishedAt: item.publishedAt,
    collectedAt: item.collectedAt,
    issueTags: item.issueTags,
    personTags: item.personTags,
    sourceType: item.sourceType,
    relevanceScore: item.relevanceScore,
    relevanceTier: item.relevanceTier,
    labels: item.labels,
    youtube: item.youtube,
    searchTerms: [
      ...item.matchedKeywords,
      ...(item.labels?.filter((label) => label !== "자동 수집") ?? [])
    ].join(" ")
  }));
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareByLatest<T extends FilterableFeedItem>(previous: T, next: T): number {
  return (
    timestamp(next.publishedAt) - timestamp(previous.publishedAt) ||
    timestamp(next.collectedAt) - timestamp(previous.collectedAt) ||
    next.relevanceScore - previous.relevanceScore
  );
}

function compareByRelevance<T extends FilterableFeedItem>(previous: T, next: T): number {
  return next.relevanceScore - previous.relevanceScore || compareByLatest(previous, next);
}

export function filterItems<T extends FilterableFeedItem>(items: T[], filters: FeedFilters): T[] {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase("ko-KR");

  const filteredItems = items.filter((item) => {
    if (
      filters.scope === "primary" &&
      isSecondaryItem(item) &&
      (normalizedQuery.length === 0 || filters.type === "youtube")
    ) {
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
      item.searchTerms ?? "",
      ...(item.matchedKeywords ?? []),
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
