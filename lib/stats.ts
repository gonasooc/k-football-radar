import type { CollectionState, Issue, Person, RadarItem } from "./schema";
import { sortItemsLatestFirst } from "./dedupe";

type CountedIssue = Issue & {
  count: number;
};

type CountedPerson = Person & {
  count: number;
};

export type DashboardStats = {
  lastCollectedAt: string;
  totalItems: number;
  newItems24h: number;
  officialItems24h: number;
  newsItems24h: number;
  topIssues: CountedIssue[];
  topPeople: CountedPerson[];
  latestItems: RadarItem[];
};

function countOccurrences<T extends { id: string; priority: number }>(
  ids: string[],
  records: T[],
  limit: number
): Array<T & { count: number }> {
  const counts = new Map<string, number>();
  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return records
    .map((record) => ({
      ...record,
      count: counts.get(record.id) ?? 0
    }))
    .filter((record) => record.count > 0)
    .sort((a, b) => b.count - a.count || a.priority - b.priority)
    .slice(0, limit);
}

export function getDashboardStats({
  items,
  issues,
  people,
  collectionState,
  now = new Date()
}: {
  items: RadarItem[];
  issues: Issue[];
  people: Person[];
  collectionState: CollectionState;
  now?: Date;
}): DashboardStats {
  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
  const recentItems = items.filter(
    (item) => new Date(item.collectedAt).getTime() >= dayAgo
  );

  const issueIds = recentItems.flatMap((item) => item.issueTags);
  const personIds = recentItems.flatMap((item) => item.personTags);

  return {
    lastCollectedAt: collectionState.lastCollectedAt,
    totalItems: collectionState.totalItems,
    newItems24h: recentItems.length,
    officialItems24h: recentItems.filter((item) => item.isOfficial).length,
    newsItems24h: recentItems.filter((item) => item.sourceType === "news").length,
    topIssues: countOccurrences(issueIds, issues, 5),
    topPeople: countOccurrences(
      personIds,
      people.filter((person) => person.published),
      5
    ),
    latestItems: sortItemsLatestFirst(items).sort((a, b) => {
      if (a.isOfficial !== b.isOfficial) {
        return a.isOfficial ? -1 : 1;
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    }).slice(0, 10)
  };
}
