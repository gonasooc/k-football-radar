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

function mergeItems(previous: RadarItem, next: RadarItem): RadarItem {
  const preferred =
    new Date(next.collectedAt).getTime() >= new Date(previous.collectedAt).getTime()
      ? next
      : previous;
  const fallback = preferred === next ? previous : next;

  return {
    ...preferred,
    matchedKeywords: uniqueSorted([
      ...fallback.matchedKeywords,
      ...preferred.matchedKeywords
    ]),
    issueTags: uniqueSorted([...fallback.issueTags, ...preferred.issueTags]),
    personTags: uniqueSorted([...fallback.personTags, ...preferred.personTags]),
    labels: uniqueSorted([...(fallback.labels ?? []), ...(preferred.labels ?? [])]),
    relevanceScore: Math.max(previous.relevanceScore, next.relevanceScore),
    isOfficial: previous.isOfficial || next.isOfficial,
    type: previous.isOfficial || next.isOfficial ? "official" : preferred.type,
    sourceType: previous.isOfficial || next.isOfficial ? "official" : preferred.sourceType
  };
}

export function dedupeItems(items: RadarItem[]): RadarItem[] {
  const byUrl = new Map<string, RadarItem>();
  const byStory = new Map<string, string>();

  for (const item of items) {
    const candidates = [
      canonicalizeUrl(item.url),
      canonicalizeUrl(item.originalUrl),
      byStory.get(storyKey(item))
    ].filter((value): value is string => Boolean(value));

    const existingKey = candidates.find((key) => byUrl.has(key));

    if (!existingKey) {
      const primaryKey = canonicalizeUrl(item.url);
      byUrl.set(primaryKey, item);
      byUrl.set(canonicalizeUrl(item.originalUrl), item);
      byStory.set(storyKey(item), primaryKey);
      continue;
    }

    const existing = byUrl.get(existingKey);
    if (!existing) {
      continue;
    }

    const merged = mergeItems(existing, item);
    const primaryKey = canonicalizeUrl(merged.url);
    byUrl.set(primaryKey, merged);
    byUrl.set(canonicalizeUrl(merged.originalUrl), merged);
    byUrl.set(canonicalizeUrl(existing.url), merged);
    byUrl.set(canonicalizeUrl(existing.originalUrl), merged);
    byUrl.set(canonicalizeUrl(item.url), merged);
    byUrl.set(canonicalizeUrl(item.originalUrl), merged);
    byStory.set(storyKey(existing), primaryKey);
    byStory.set(storyKey(item), primaryKey);
    byStory.set(storyKey(merged), primaryKey);
  }

  return sortItemsLatestFirst(Array.from(new Set(byUrl.values())));
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

export function limitItems(items: RadarItem[], now = new Date()): RadarItem[] {
  const ninetyDaysAgo = now.getTime() - 90 * 24 * 60 * 60 * 1000;
  return sortItemsLatestFirst(dedupeItems(items))
    .filter((item) => new Date(item.publishedAt).getTime() >= ninetyDaysAgo)
    .slice(0, 2000);
}
