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
    const hostname = url.hostname.toLocaleLowerCase("en-US").replace(/^www\./, "");
    const youtubeVideoId =
      hostname === "youtu.be"
        ? url.pathname.split("/").filter(Boolean)[0]
        : hostname === "youtube.com" ||
            hostname === "m.youtube.com" ||
            hostname === "youtube-nocookie.com"
          ? url.searchParams.get("v") ??
            url.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/)?.[1]
          : undefined;
    if (youtubeVideoId) {
      return `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeVideoId)}`;
    }
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

// Broadcasters re-upload the same report under a new video id when it airs on
// another programme, and news APIs re-stamp an updated article, so an identical
// title from one publisher within this window is treated as one story even
// though the URLs and timestamps differ. Kept tight because a recurring
// programme that reuses one title verbatim would merge inside it: the widest
// re-publication gap observed in the corpus is ~16h, so 24h clears every real
// duplicate without reaching a daily cadence.
const NEAR_DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

function nearDuplicateKey(item: RadarItem): string {
  return [
    item.title.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR"),
    item.publisher.trim().toLocaleLowerCase("ko-KR")
  ].join("|");
}

function storyKey(item: RadarItem): string {
  return [nearDuplicateKey(item), item.publishedAt].join("|");
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
  // Re-collections of an undated official item stamp publishedAt with the run
  // time, so the earliest known publication time must win or the item drifts
  // forward on every run and never ages out of retention.
  const publishedAt =
    new Date(next.publishedAt).getTime() < new Date(previous.publishedAt).getTime()
      ? next.publishedAt
      : previous.publishedAt;
  const discoveryQueries = uniqueSorted([
    ...(previous.discoveryQueries ?? []),
    ...(next.discoveryQueries ?? [])
  ]);

  return {
    ...preferred,
    collectedAt,
    publishedAt,
    discoveryQueries: discoveryQueries.length > 0 ? discoveryQueries : undefined
  };
}

type DedupeGroup = {
  item: RadarItem;
  latestCollectedAt: number;
  earliestPublishedAt: number;
  urls: Set<string>;
  stories: Set<string>;
  nearKeys: Set<string>;
};

export function dedupeItems(items: RadarItem[]): RadarItem[] {
  const byUrl = new Map<string, DedupeGroup>();
  const byStory = new Map<string, DedupeGroup>();
  const byNearKey = new Map<string, Set<DedupeGroup>>();
  const groups = new Set<DedupeGroup>();

  const registerNearKeys = (group: DedupeGroup): void => {
    for (const nearKey of group.nearKeys) {
      const bucket = byNearKey.get(nearKey);
      if (bucket) {
        bucket.add(group);
      } else {
        byNearKey.set(nearKey, new Set([group]));
      }
    }
  };
  const unregisterNearKeys = (group: DedupeGroup): void => {
    for (const nearKey of group.nearKeys) {
      byNearKey.get(nearKey)?.delete(group);
    }
  };

  for (const item of items) {
    const urls = new Set([
      canonicalizeUrl(item.url),
      canonicalizeUrl(item.originalUrl)
    ]);
    const story = storyKey(item);
    const nearKey = nearDuplicateKey(item);
    const publishedAt = new Date(item.publishedAt).getTime();
    const matchingGroups = new Set(
      [...urls].map((url) => byUrl.get(url)).filter((group) => group !== undefined)
    );
    const storyGroup = byStory.get(story);
    if (storyGroup) {
      matchingGroups.add(storyGroup);
    }
    if (Number.isFinite(publishedAt)) {
      // Anchoring on the group's earliest publication keeps a cluster inside a
      // single window: a recurring programme that reuses one title cannot chain
      // episode to episode into one endlessly growing group.
      for (const candidate of byNearKey.get(nearKey) ?? []) {
        if (
          Math.abs(candidate.earliestPublishedAt - publishedAt) <=
          NEAR_DUPLICATE_WINDOW_MS
        ) {
          matchingGroups.add(candidate);
        }
      }
    }

    if (matchingGroups.size === 0) {
      const group: DedupeGroup = {
        item,
        latestCollectedAt: new Date(item.collectedAt).getTime(),
        earliestPublishedAt: publishedAt,
        urls,
        stories: new Set([story]),
        nearKeys: new Set([nearKey])
      };
      groups.add(group);
      for (const url of urls) {
        byUrl.set(url, group);
      }
      byStory.set(story, group);
      registerNearKeys(group);
      continue;
    }

    const [group, ...otherGroups] = matchingGroups;
    unregisterNearKeys(group);
    for (const other of otherGroups) {
      const preferOther = other.latestCollectedAt >= group.latestCollectedAt;
      group.item = mergeItems(group.item, other.item, preferOther);
      group.latestCollectedAt = Math.max(
        group.latestCollectedAt,
        other.latestCollectedAt
      );
      group.earliestPublishedAt = Math.min(
        group.earliestPublishedAt,
        other.earliestPublishedAt
      );
      for (const url of other.urls) {
        group.urls.add(url);
      }
      for (const otherStory of other.stories) {
        group.stories.add(otherStory);
      }
      for (const otherNearKey of other.nearKeys) {
        group.nearKeys.add(otherNearKey);
      }
      unregisterNearKeys(other);
      groups.delete(other);
    }

    const itemCollectedAt = new Date(item.collectedAt).getTime();
    group.item = mergeItems(
      group.item,
      item,
      itemCollectedAt >= group.latestCollectedAt
    );
    group.latestCollectedAt = Math.max(group.latestCollectedAt, itemCollectedAt);
    if (Number.isFinite(publishedAt)) {
      group.earliestPublishedAt = Number.isFinite(group.earliestPublishedAt)
        ? Math.min(group.earliestPublishedAt, publishedAt)
        : publishedAt;
    }
    for (const url of urls) {
      group.urls.add(url);
    }
    group.stories.add(story);
    group.stories.add(storyKey(group.item));
    group.nearKeys.add(nearKey);
    group.nearKeys.add(nearDuplicateKey(group.item));

    for (const url of group.urls) {
      byUrl.set(url, group);
    }
    for (const groupStory of group.stories) {
      byStory.set(groupStory, group);
    }
    registerNearKeys(group);
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
