import {
  defaultFeedFilters,
  filterItems,
  type FeedFilters,
  type FeedItem
} from "./filter";
import type { StoryClusterFile } from "./schema";
// Imported from the similarity module, not the feed context: this module is
// reachable from client components, so it must stay free of Node-only imports.
import {
  createStorySimilarityModels,
  type StorySimilarityModel,
  type StorySimilarityModels
} from "./story-similarity";

export const DEFAULT_FEED_PAGE_SIZE = 30;
export const MAX_FEED_PAGE_SIZE = 100;

const EMPTY_STORY_CLUSTERS: StoryClusterFile = { version: 1, clusters: [] };

export type RelatedFeedItem = Pick<
  FeedItem,
  "id" | "title" | "url" | "publisher" | "publishedAt"
>;

export type StoryFeedEntry = {
  id: string;
  representative: FeedItem;
  related: RelatedFeedItem[];
  itemCount: number;
  latestPublishedAt: string;
  maxRelevanceScore: number;
};

export type FeedPage = {
  entries: StoryFeedEntry[];
  totalEntries: number;
  totalItems: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  snapshot: string;
};

type FeedPagination = {
  offset: number;
  limit: number;
};

type StoryGroup = {
  id: string;
  members: FeedItem[];
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

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareItemsByLatest(previous: FeedItem, next: FeedItem): number {
  return (
    timestamp(next.publishedAt) - timestamp(previous.publishedAt) ||
    timestamp(next.collectedAt) - timestamp(previous.collectedAt) ||
    next.relevanceScore - previous.relevanceScore ||
    previous.id.localeCompare(next.id)
  );
}

function toRelatedFeedItem({
  id,
  title,
  url,
  publisher,
  publishedAt
}: FeedItem): RelatedFeedItem {
  return { id, title, url, publisher, publishedAt };
}

function getTitleSummaryOverlap(item: FeedItem): number {
  const tokens = Array.from(
    new Set(item.title.normalize("NFKC").toLocaleLowerCase("ko-KR").match(/[\p{L}\p{N}]+/gu) ?? [])
  );
  if (tokens.length === 0) {
    return 0;
  }

  const summary = item.summary.normalize("NFKC").toLocaleLowerCase("ko-KR");
  return tokens.filter((token) => summary.includes(token)).length / tokens.length;
}

function measureCompleteness(item: FeedItem): number {
  const normalizedTitle = item.title.normalize("NFKC").trim();
  const hasCompleteTitle = !/(?:\.{2,}|…+)\s*$/u.test(normalizedTitle);
  const summaryLength = Array.from(item.summary.normalize("NFKC").trim()).length;

  return (
    (hasCompleteTitle ? 0.4 : 0) +
    0.3 * getTitleSummaryOverlap(item) +
    0.3 * Math.min(summaryLength / 120, 1)
  );
}

// Completeness depends only on the item's own text, so it is measured once per
// item object and reused for every later request. Like the similarity memo, the
// entries drop with the snapshot that created the items.
const completenessByItem = new WeakMap<FeedItem, number>();

function getCompleteness(item: FeedItem): number {
  const cached = completenessByItem.get(item);
  if (cached !== undefined) {
    return cached;
  }

  const completeness = measureCompleteness(item);
  completenessByItem.set(item, completeness);
  return completeness;
}

function chooseRepresentative(
  members: readonly FeedItem[],
  similarityModel: StorySimilarityModel
): FeedItem {
  // Most groups are a single unclustered item, and scoring one candidate against
  // itself always returns it. Skipping the scan avoids normalizing the title and
  // summary of nearly every stored item on every request.
  if (members.length === 1) {
    return members[0]!;
  }

  const primaryMembers = members.filter((item) => item.relevanceTier !== "secondary");
  const candidates = primaryMembers.length > 0 ? primaryMembers : [...members];
  const publishedTimes = members.map((item) => timestamp(item.publishedAt));
  const oldestPublishedAt = Math.min(...publishedTimes);
  const newestPublishedAt = Math.max(...publishedTimes);
  const freshnessRange = newestPublishedAt - oldestPublishedAt;

  function centrality(candidate: FeedItem): number {
    if (members.length === 1) {
      return 1;
    }

    const total = members.reduce(
      (sum, member) =>
        member.id === candidate.id
          ? sum
          : sum + similarityModel.compare(candidate, member).combined,
      0
    );
    return total / (members.length - 1);
  }

  function score(candidate: FeedItem): number {
    const freshness =
      freshnessRange === 0
        ? 1
        : (timestamp(candidate.publishedAt) - oldestPublishedAt) / freshnessRange;
    return (
      50 * centrality(candidate) +
      25 * (candidate.relevanceScore / 100) +
      20 * getCompleteness(candidate) +
      5 * freshness
    );
  }

  return candidates
    .map((item) => ({ item, score: score(item) }))
    .sort(
      (previous, next) =>
        next.score - previous.score ||
        timestamp(next.item.publishedAt) - timestamp(previous.item.publishedAt) ||
        timestamp(previous.item.collectedAt) - timestamp(next.item.collectedAt) ||
        previous.item.id.localeCompare(next.item.id)
    )[0]!.item;
}

function createVisibleStoryGroups(
  filteredItems: readonly FeedItem[],
  storyClusters: StoryClusterFile
): StoryGroup[] {
  const visibleById = new Map(filteredItems.map((item) => [item.id, item]));
  const assignedIds = new Set<string>();
  const groups: StoryGroup[] = [];

  for (const cluster of storyClusters.clusters) {
    const members: FeedItem[] = [];
    for (const memberId of cluster.memberIds) {
      const member = visibleById.get(memberId);
      if (!member || member.sourceType === "official" || assignedIds.has(member.id)) {
        continue;
      }
      members.push(member);
      assignedIds.add(member.id);
    }

    if (members.length > 0) {
      groups.push({ id: cluster.id, members });
    }
  }

  for (const item of filteredItems) {
    if (!assignedIds.has(item.id)) {
      groups.push({ id: item.id, members: [item] });
    }
  }

  return groups;
}

function toStoryFeedEntry(
  group: StoryGroup,
  similarityModel: StorySimilarityModel
): StoryFeedEntry {
  const representative = chooseRepresentative(group.members, similarityModel);
  const newestFirst = [...group.members].sort(compareItemsByLatest);

  return {
    id: group.id,
    representative,
    related: newestFirst
      .filter((item) => item.id !== representative.id)
      .map(toRelatedFeedItem),
    itemCount: group.members.length,
    latestPublishedAt: newestFirst[0]!.publishedAt,
    maxRelevanceScore: Math.max(...group.members.map((item) => item.relevanceScore))
  };
}

function compareEntriesByLatest(
  previous: StoryFeedEntry,
  next: StoryFeedEntry
): number {
  return (
    timestamp(next.latestPublishedAt) - timestamp(previous.latestPublishedAt) ||
    next.maxRelevanceScore - previous.maxRelevanceScore ||
    previous.id.localeCompare(next.id)
  );
}

function compareEntriesByRelevance(
  previous: StoryFeedEntry,
  next: StoryFeedEntry
): number {
  return (
    next.maxRelevanceScore - previous.maxRelevanceScore ||
    compareEntriesByLatest(previous, next)
  );
}

export function getFeedPage(
  items: FeedItem[],
  filters: FeedFilters = defaultFeedFilters,
  {
    offset: rawOffset = 0,
    limit: rawLimit = DEFAULT_FEED_PAGE_SIZE,
    snapshot = "",
    storyClusters = EMPTY_STORY_CLUSTERS,
    similarityModels
  }: {
    offset?: string | number;
    limit?: string | number;
    snapshot?: string;
    storyClusters?: StoryClusterFile;
    similarityModels?: StorySimilarityModels;
  } = {}
): FeedPage {
  const { offset, limit } = getFeedPagination({
    offset: rawOffset,
    limit: rawLimit
  });
  const filteredItems = filterItems(items, filters);
  // Per-medium models keep the news IDF corpus stable when videos are present;
  // both rank representatives only, so raw title/summary text is enough. Callers
  // serving live data pass models cached per snapshot instead of rebuilding the
  // corpus for every request.
  const models = similarityModels ?? createStorySimilarityModels(items);
  const entries = createVisibleStoryGroups(filteredItems, storyClusters)
    .map((group) =>
      toStoryFeedEntry(
        group,
        group.members[0]!.sourceType === "youtube" ? models.youtube : models.news
      )
    )
    .sort(filters.sort === "relevance" ? compareEntriesByRelevance : compareEntriesByLatest);
  const pageEntries = entries.slice(offset, offset + limit);

  return {
    entries: pageEntries,
    totalEntries: entries.length,
    totalItems: filteredItems.length,
    offset,
    limit,
    hasMore: offset + pageEntries.length < entries.length,
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
