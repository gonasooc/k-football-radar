import type { RadarItem } from "./schema";

const TRACKING_PARAMS = [
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "n_media",
  "n_query",
  "n_rank",
  "n_url",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term"
];

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "ko-KR"));
}

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    for (const param of Array.from(url.searchParams.keys())) {
      const normalizedParam = param.toLocaleLowerCase("en-US");
      if (normalizedParam.startsWith("utm_") || TRACKING_PARAMS.includes(normalizedParam)) {
        url.searchParams.delete(param);
      }
    }
    url.searchParams.sort();
    url.hostname = url.hostname.toLocaleLowerCase("en-US");
    const normalized = url.toString();
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  } catch {
    return rawUrl.trim();
  }
}

function storyKey(item: RadarItem): string {
  return [
    item.title.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR"),
    item.publisher.trim().toLocaleLowerCase("ko-KR"),
    item.publishedAt
  ].join("|");
}

function mergeItems(
  previous: RadarItem,
  next: RadarItem,
  preferNext: boolean
): RadarItem {
  const preferred =
    previous.isOfficial !== next.isOfficial
      ? previous.isOfficial
        ? previous
        : next
      : preferNext
        ? next
        : previous;
  const collectedAt =
    new Date(next.collectedAt).getTime() < new Date(previous.collectedAt).getTime()
      ? next.collectedAt
      : previous.collectedAt;
  const discoveryQueries = uniqueSorted([
    ...(previous.discoveryQueries ?? []),
    ...(next.discoveryQueries ?? [])
  ]);

  return {
    ...preferred,
    collectedAt,
    discoveryQueries: discoveryQueries.length > 0 ? discoveryQueries : undefined
  };
}

type DedupeGroup = {
  item: RadarItem;
  latestCollectedAt: number;
  urls: Set<string>;
  stories: Set<string>;
};

export function dedupeItems(items: RadarItem[]): RadarItem[] {
  const byUrl = new Map<string, DedupeGroup>();
  const byStory = new Map<string, DedupeGroup>();
  const groups = new Set<DedupeGroup>();

  for (const item of items) {
    const urls = new Set([
      canonicalizeUrl(item.url),
      canonicalizeUrl(item.originalUrl)
    ]);
    const story = storyKey(item);
    const matchingGroups = new Set(
      [...urls].map((url) => byUrl.get(url)).filter((group) => group !== undefined)
    );
    const storyGroup = byStory.get(story);
    if (storyGroup) {
      matchingGroups.add(storyGroup);
    }

    if (matchingGroups.size === 0) {
      const group: DedupeGroup = {
        item,
        latestCollectedAt: new Date(item.collectedAt).getTime(),
        urls,
        stories: new Set([story])
      };
      groups.add(group);
      for (const url of urls) {
        byUrl.set(url, group);
      }
      byStory.set(story, group);
      continue;
    }

    const [group, ...otherGroups] = matchingGroups;
    for (const other of otherGroups) {
      const preferOther = other.latestCollectedAt >= group.latestCollectedAt;
      group.item = mergeItems(group.item, other.item, preferOther);
      group.latestCollectedAt = Math.max(
        group.latestCollectedAt,
        other.latestCollectedAt
      );
      for (const url of other.urls) {
        group.urls.add(url);
      }
      for (const otherStory of other.stories) {
        group.stories.add(otherStory);
      }
      groups.delete(other);
    }

    const itemCollectedAt = new Date(item.collectedAt).getTime();
    group.item = mergeItems(
      group.item,
      item,
      itemCollectedAt >= group.latestCollectedAt
    );
    group.latestCollectedAt = Math.max(group.latestCollectedAt, itemCollectedAt);
    for (const url of urls) {
      group.urls.add(url);
    }
    group.stories.add(story);
    group.stories.add(storyKey(group.item));

    for (const url of group.urls) {
      byUrl.set(url, group);
    }
    for (const groupStory of group.stories) {
      byStory.set(groupStory, group);
    }
  }

  return sortItemsLatestFirst([...groups].map((group) => group.item));
}

export function sortItemsLatestFirst(items: RadarItem[]): RadarItem[] {
  return [...items].sort((a, b) => {
    const publishedDifference =
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    if (publishedDifference !== 0) {
      return publishedDifference;
    }
    return new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime();
  });
}
