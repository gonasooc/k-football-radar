import { sortItemsLatestFirst } from "./dedupe";
import type { RadarItem } from "./schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_ITEM_RETENTION_DAYS = 90;
export const DEFAULT_MAX_RETAINED_ITEMS = 4000;
export const DEFAULT_MAX_RETAINED_SECONDARY_ITEMS = 700;
export const DEFAULT_MAX_RETAINED_YOUTUBE_ITEMS = 500;

function parseBoundedInteger({
  value,
  fallback,
  min,
  max
}: {
  value?: string;
  fallback: number;
  min: number;
  max: number;
}): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

export function getItemRetentionDays(
  value = process.env.ITEM_RETENTION_DAYS
): number {
  return parseBoundedInteger({
    value,
    fallback: DEFAULT_ITEM_RETENTION_DAYS,
    min: 1,
    max: 3650
  });
}

export function getMaxRetainedItems(
  value = process.env.MAX_RETAINED_ITEMS
): number {
  return parseBoundedInteger({
    value,
    fallback: DEFAULT_MAX_RETAINED_ITEMS,
    min: 1,
    max: 100000
  });
}

export function getMaxRetainedSecondaryItems(
  value = process.env.MAX_RETAINED_SECONDARY_ITEMS
): number {
  return parseBoundedInteger({
    value,
    fallback: DEFAULT_MAX_RETAINED_SECONDARY_ITEMS,
    min: 1,
    max: 100000
  });
}

export function getMaxRetainedYouTubeItems(
  value = process.env.MAX_RETAINED_YOUTUBE_ITEMS
): number {
  return parseBoundedInteger({
    value,
    fallback: DEFAULT_MAX_RETAINED_YOUTUBE_ITEMS,
    min: 1,
    max: 100000
  });
}

export function isPublishedAtWithinRetention({
  publishedAt,
  now = new Date(),
  retentionDays = getItemRetentionDays()
}: {
  publishedAt: string;
  now?: Date;
  retentionDays?: number;
}): boolean {
  const publishedTime = new Date(publishedAt).getTime();
  if (!Number.isFinite(publishedTime)) {
    return false;
  }

  const cutoffTime = now.getTime() - retentionDays * MS_PER_DAY;
  return publishedTime >= cutoffTime;
}

/**
 * Official releases are the highest-value source, so they stay in the primary
 * budget even if classification only found secondary-strength evidence.
 */
function isPrimaryEditorialItem(item: RadarItem): boolean {
  return item.sourceType === "official" || item.relevanceTier !== "secondary";
}

export function applyItemRetentionPolicy(
  items: RadarItem[],
  {
    now = new Date(),
    retentionDays = getItemRetentionDays(),
    maxItems = getMaxRetainedItems(),
    maxSecondaryItems = getMaxRetainedSecondaryItems(),
    maxYouTubeItems = getMaxRetainedYouTubeItems()
  }: {
    now?: Date;
    retentionDays?: number;
    maxItems?: number;
    maxSecondaryItems?: number;
    maxYouTubeItems?: number;
  } = {}
): RadarItem[] {
  const retained = items.filter((item) =>
    isPublishedAtWithinRetention({
      publishedAt: item.publishedAt,
      now,
      retentionDays
    })
  );
  // Three independent budgets. Secondary items are only reachable through the
  // "전체" scope but arrive nearly as fast as primary ones, so without their own
  // cap they consume roughly half the editorial budget and cut how far back the
  // default feed, issue timelines and person timelines reach.
  const editorialItems = retained.filter((item) => item.sourceType !== "youtube");
  const primaryItems = sortItemsLatestFirst(
    editorialItems.filter(isPrimaryEditorialItem)
  ).slice(0, maxItems);
  const secondaryItems = sortItemsLatestFirst(
    editorialItems.filter((item) => !isPrimaryEditorialItem(item))
  ).slice(0, maxSecondaryItems);
  const youtubeItems = sortItemsLatestFirst(
    retained.filter((item) => item.sourceType === "youtube")
  ).slice(0, maxYouTubeItems);

  return sortItemsLatestFirst([
    ...primaryItems,
    ...secondaryItems,
    ...youtubeItems
  ]);
}
