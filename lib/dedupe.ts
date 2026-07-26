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
  return Array.from(new Set(values)).sort(compareLocalizedTextTotal);
}

function compareStableText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareLocalizedTextTotal(left: string, right: string): number {
  return (
    left.localeCompare(right, "ko-KR") || compareStableText(left, right)
  );
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([leftKey], [rightKey]) => compareStableText(leftKey, rightKey));
  return `{${entries
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${stableSerialize(entryValue)}`
    )
    .join(",")}}`;
}

const MERGED_AGGREGATE_FIELDS = new Set([
  "collectedAt",
  "publishedAt",
  "discoveryQueries",
  "dedupeState"
]);

function representativeTieBreaker(item: RadarItem): string {
  // mergeItems accumulates these fields instead of preserving them from the
  // selected representative, and persistDedupeState regenerates dedupeState.
  // Excluding them makes a persisted group compare exactly like the raw
  // representative that produced it on a later collection run.
  return stableSerialize(
    Object.fromEntries(
      Object.entries(item).filter(
        ([key]) => !MERGED_AGGREGATE_FIELDS.has(key)
      )
    )
  );
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
    item.type,
    item.sourceType,
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
  representativeCollectedAt: number;
  earliestPublishedAt: number;
  latestPublishedAt: number;
  representativeTieBreaker: string;
  urls: Set<string>;
  stories: Set<string>;
  nearKeys: Set<string>;
};

function setsEqual<T>(left: ReadonlySet<T>, right: ReadonlySet<T>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function withoutDedupeState(item: RadarItem): RadarItem {
  const cleanItem = { ...item };
  delete cleanItem.dedupeState;
  return cleanItem;
}

function persistDedupeState(group: DedupeGroup): RadarItem {
  const item = withoutDedupeState(group.item);
  const itemPublishedAt = new Date(item.publishedAt).getTime();
  const itemCollectedAt = new Date(item.collectedAt).getTime();
  const reconstructibleUrls = new Set([
    canonicalizeUrl(item.url),
    canonicalizeUrl(item.originalUrl)
  ]);
  const reconstructibleStories = new Set([storyKey(item)]);
  const reconstructibleNearKeys = new Set([nearDuplicateKey(item)]);
  const needsState =
    !setsEqual(group.urls, reconstructibleUrls) ||
    !setsEqual(group.stories, reconstructibleStories) ||
    !setsEqual(group.nearKeys, reconstructibleNearKeys) ||
    group.earliestPublishedAt !== itemPublishedAt ||
    group.latestPublishedAt !== itemPublishedAt ||
    group.representativeCollectedAt !== itemCollectedAt ||
    group.latestCollectedAt !== itemCollectedAt;

  if (!needsState) {
    return item;
  }

  return {
    ...item,
    dedupeState: {
      version: 1,
      urls: uniqueSorted([...group.urls]),
      stories: uniqueSorted([...group.stories]),
      nearKeys: uniqueSorted([...group.nearKeys]),
      earliestPublishedAt: group.earliestPublishedAt,
      latestPublishedAt: group.latestPublishedAt,
      representativeCollectedAt: group.representativeCollectedAt,
      latestCollectedAt: group.latestCollectedAt
    }
  };
}

function compareItemsForDedupe(a: RadarItem, b: RadarItem): number {
  const publishedDifference =
    new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
  if (publishedDifference !== 0) {
    return publishedDifference;
  }

  const collectedDifference =
    new Date(a.collectedAt).getTime() - new Date(b.collectedAt).getTime();
  if (collectedDifference !== 0) {
    return collectedDifference;
  }

  const identityDifference = compareStableText(
    [a.type, a.sourceType, a.id, a.url, a.originalUrl].join("|"),
    [b.type, b.sourceType, b.id, b.url, b.originalUrl].join("|")
  );
  if (identityDifference !== 0) {
    return identityDifference;
  }

  // Two observations can share every identity and timestamp field while their
  // summaries or classification metadata differ. Compare representative
  // fields first, then accumulator-only fields for a total processing order.
  const representativeDifference = compareStableText(
    representativeTieBreaker(a),
    representativeTieBreaker(b)
  );
  return representativeDifference !== 0
    ? representativeDifference
    : compareStableText(stableSerialize(a), stableSerialize(b));
}

function shouldPreferNextRepresentative(
  previous: RadarItem,
  next: RadarItem,
  previousRepresentativeCollectedAt: number,
  nextRepresentativeCollectedAt: number,
  previousTieBreaker: string,
  nextTieBreaker: string
): boolean {
  if (previous.isOfficial !== next.isOfficial) {
    return next.isOfficial;
  }
  if (previousRepresentativeCollectedAt !== nextRepresentativeCollectedAt) {
    return nextRepresentativeCollectedAt > previousRepresentativeCollectedAt;
  }
  return compareStableText(nextTieBreaker, previousTieBreaker) > 0;
}

function canMergePublishedSpan(
  groups: Iterable<DedupeGroup>,
  incomingEarliestPublishedAt: number,
  incomingLatestPublishedAt: number
): boolean {
  if (
    !Number.isFinite(incomingEarliestPublishedAt) ||
    !Number.isFinite(incomingLatestPublishedAt)
  ) {
    return false;
  }

  let earliestPublishedAt = incomingEarliestPublishedAt;
  let latestPublishedAt = incomingLatestPublishedAt;
  for (const group of groups) {
    if (
      !Number.isFinite(group.earliestPublishedAt) ||
      !Number.isFinite(group.latestPublishedAt)
    ) {
      return false;
    }
    earliestPublishedAt = Math.min(
      earliestPublishedAt,
      group.earliestPublishedAt
    );
    latestPublishedAt = Math.max(latestPublishedAt, group.latestPublishedAt);
  }

  return (
    latestPublishedAt - earliestPublishedAt <= NEAR_DUPLICATE_WINDOW_MS
  );
}

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

  // Process in a stable chronological order so the same set of records always
  // produces the same bounded near-duplicate groups, regardless of collection
  // or shard order. The collected time and stable identity tie-breakers retain
  // the existing newest-collection representative semantics.
  for (const item of [...items].sort(compareItemsForDedupe)) {
    const persistedState = item.dedupeState;
    const urls = new Set([
      canonicalizeUrl(item.url),
      canonicalizeUrl(item.originalUrl),
      ...(persistedState?.urls.map(canonicalizeUrl) ?? [])
    ]);
    const nearKey = nearDuplicateKey(item);
    const publishedAt = new Date(item.publishedAt).getTime();
    const collectedAt = new Date(item.collectedAt).getTime();
    // A persisted representative carries the group's earliest publishedAt,
    // which can differ from the publication time of the observation whose
    // title it preserves. Recombining those fields would manufacture a story
    // alias that never existed and incorrectly promote later soft matches to
    // hard duplicate evidence. Raw items contribute their observed story;
    // persisted groups contribute only their recorded authentic aliases.
    const stories = new Set(
      persistedState === undefined
        ? [storyKey(item)]
        : persistedState.stories
    );
    const nearKeys = new Set([nearKey, ...(persistedState?.nearKeys ?? [])]);
    const earliestPublishedAt = Math.min(
      publishedAt,
      persistedState?.earliestPublishedAt ?? publishedAt
    );
    const latestPublishedAt = Math.max(
      publishedAt,
      persistedState?.latestPublishedAt ?? publishedAt
    );
    const latestCollectedAt = Math.max(
      collectedAt,
      persistedState?.latestCollectedAt ?? collectedAt
    );
    const representativeCollectedAt =
      persistedState?.representativeCollectedAt ?? collectedAt;
    const itemTieBreaker = representativeTieBreaker(item);
    // URL aliases and exact stories are hard duplicate evidence and retain the
    // existing transitive merge semantics. Title/publisher matches are softer:
    // only add them when the span of the complete prospective group stays
    // inside the near-duplicate window.
    const matchingGroups = new Set(
      [...urls].map((url) => byUrl.get(url)).filter((group) => group !== undefined)
    );
    for (const storyAlias of stories) {
      const storyGroup = byStory.get(storyAlias);
      if (storyGroup) {
        matchingGroups.add(storyGroup);
      }
    }
    if (
      Number.isFinite(earliestPublishedAt) &&
      Number.isFinite(latestPublishedAt)
    ) {
      const candidates = [
        ...new Set(
          [...nearKeys].flatMap((key) => [...(byNearKey.get(key) ?? [])])
        )
      ].sort(
        (a, b) =>
          a.earliestPublishedAt - b.earliestPublishedAt ||
          a.latestPublishedAt - b.latestPublishedAt ||
          compareLocalizedTextTotal(a.item.id, b.item.id)
      );
      for (const candidate of candidates) {
        if (
          !matchingGroups.has(candidate) &&
          canMergePublishedSpan(
            [...matchingGroups, candidate],
            earliestPublishedAt,
            latestPublishedAt
          )
        ) {
          matchingGroups.add(candidate);
        }
      }
    }

    if (matchingGroups.size === 0) {
      const group: DedupeGroup = {
        item,
        latestCollectedAt,
        representativeCollectedAt,
        earliestPublishedAt,
        latestPublishedAt,
        representativeTieBreaker: itemTieBreaker,
        urls,
        stories,
        nearKeys
      };
      groups.add(group);
      for (const url of urls) {
        byUrl.set(url, group);
      }
      for (const storyAlias of stories) {
        byStory.set(storyAlias, group);
      }
      registerNearKeys(group);
      continue;
    }

    const [group, ...otherGroups] = matchingGroups;
    unregisterNearKeys(group);
    for (const other of otherGroups) {
      const preferOther = shouldPreferNextRepresentative(
        group.item,
        other.item,
        group.representativeCollectedAt,
        other.representativeCollectedAt,
        group.representativeTieBreaker,
        other.representativeTieBreaker
      );
      group.item = mergeItems(group.item, other.item, preferOther);
      if (preferOther) {
        group.representativeTieBreaker = other.representativeTieBreaker;
        group.representativeCollectedAt = other.representativeCollectedAt;
      }
      group.latestCollectedAt = Math.max(
        group.latestCollectedAt,
        other.latestCollectedAt
      );
      group.earliestPublishedAt = Math.min(
        group.earliestPublishedAt,
        other.earliestPublishedAt
      );
      group.latestPublishedAt = Math.max(
        group.latestPublishedAt,
        other.latestPublishedAt
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

    const preferItem = shouldPreferNextRepresentative(
      group.item,
      item,
      group.representativeCollectedAt,
      representativeCollectedAt,
      group.representativeTieBreaker,
      itemTieBreaker
    );
    group.item = mergeItems(group.item, item, preferItem);
    if (preferItem) {
      group.representativeTieBreaker = itemTieBreaker;
      group.representativeCollectedAt = representativeCollectedAt;
    }
    group.latestCollectedAt = Math.max(
      group.latestCollectedAt,
      latestCollectedAt
    );
    if (
      Number.isFinite(earliestPublishedAt) &&
      Number.isFinite(latestPublishedAt)
    ) {
      group.earliestPublishedAt = Number.isFinite(group.earliestPublishedAt)
        ? Math.min(group.earliestPublishedAt, earliestPublishedAt)
        : earliestPublishedAt;
      group.latestPublishedAt = Number.isFinite(group.latestPublishedAt)
        ? Math.max(group.latestPublishedAt, latestPublishedAt)
        : latestPublishedAt;
    }
    for (const url of urls) {
      group.urls.add(url);
    }
    for (const storyAlias of stories) {
      group.stories.add(storyAlias);
    }
    for (const persistedNearKey of nearKeys) {
      group.nearKeys.add(persistedNearKey);
    }
    group.nearKeys.add(nearDuplicateKey(group.item));

    for (const url of group.urls) {
      byUrl.set(url, group);
    }
    for (const groupStory of group.stories) {
      byStory.set(groupStory, group);
    }
    registerNearKeys(group);
  }

  return sortItemsLatestFirst([...groups].map(persistDedupeState));
}

export function sortItemsLatestFirst(items: RadarItem[]): RadarItem[] {
  return [...items].sort((a, b) => {
    const publishedDifference =
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    if (publishedDifference !== 0) {
      return publishedDifference;
    }
    const collectedDifference =
      new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime();
    if (collectedDifference !== 0) {
      return collectedDifference;
    }
    const representativeDifference = compareStableText(
      representativeTieBreaker(a),
      representativeTieBreaker(b)
    );
    return representativeDifference !== 0
      ? representativeDifference
      : compareStableText(stableSerialize(a), stableSerialize(b));
  });
}
