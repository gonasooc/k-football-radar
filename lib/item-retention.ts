import { sortItemsLatestFirst } from "./dedupe";
import type { RadarItem } from "./schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_ITEM_RETENTION_DAYS = 90;
export const DEFAULT_MAX_RETAINED_ITEMS = 2000;

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
    maxItems = getMaxRetainedItems()
  }: {
    now?: Date;
    retentionDays?: number;
    maxItems?: number;
  } = {}
): RadarItem[] {
  return sortItemsLatestFirst(
    items.filter((item) =>
      isPublishedAtWithinRetention({
        publishedAt: item.publishedAt,
        now,
        retentionDays
      })
    )
  ).slice(0, maxItems);
}
