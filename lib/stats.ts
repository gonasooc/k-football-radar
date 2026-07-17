import type { CollectionState, RadarItem } from "./schema";

export type DashboardStats = {
  lastCollectedAt: string;
  totalItems: number;
  newItems24h: number;
  officialItems24h: number;
  newsItems24h: number;
};

export function getDashboardStats({
  items,
  collectionState,
  now = new Date()
}: {
  items: RadarItem[];
  collectionState: CollectionState;
  now?: Date;
}): DashboardStats {
  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
  const recentItems = items.filter(
    (item) => new Date(item.collectedAt).getTime() >= dayAgo
  );

  return {
    lastCollectedAt: collectionState.lastCollectedAt,
    totalItems: items.length,
    newItems24h: recentItems.length,
    officialItems24h: recentItems.filter((item) => item.isOfficial).length,
    newsItems24h: recentItems.filter((item) => item.sourceType === "news").length
  };
}
