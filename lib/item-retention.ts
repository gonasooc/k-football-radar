import { sortItemsLatestFirst } from "./dedupe";
import type { RadarItem } from "./schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_ITEM_RETENTION_DAYS = 90;
export const DEFAULT_MAX_RETAINED_ITEMS = 2000;
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

export function applyItemRetentionPolicy(
  items: RadarItem[],
  {
    now = new Date(),
    retentionDays = getItemRetentionDays(),
    maxItems = getMaxRetainedItems(),
    maxYouTubeItems = getMaxRetainedYouTubeItems()
  }: {
    now?: Date;
    retentionDays?: number;
    maxItems?: number;
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
  const standardItems = sortItemsLatestFirst(
    retained.filter((item) => item.sourceType !== "youtube")
  ).slice(0, maxItems);
  const youtubeItems = sortItemsLatestFirst(
    retained.filter((item) => item.sourceType === "youtube")
  ).slice(0, maxYouTubeItems);

  return sortItemsLatestFirst([...standardItems, ...youtubeItems]);
}
