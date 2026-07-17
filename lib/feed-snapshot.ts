import { createHash } from "node:crypto";

import type { RadarItem, StoryClusterFile } from "./schema";

const FEED_CONTENT_REVISION_VERSION = 1;

type FeedRevisionItem = Pick<
  RadarItem,
  | "id"
  | "title"
  | "summary"
  | "url"
  | "publisher"
  | "publishedAt"
  | "collectedAt"
  | "matchedKeywords"
  | "issueTags"
  | "personTags"
  | "sourceType"
  | "relevanceScore"
  | "relevanceTier"
  | "labels"
  | "youtube"
>;

function compareIds(left: { id: string }, right: { id: string }): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function toFeedRevisionItem(item: RadarItem): FeedRevisionItem {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    url: item.url,
    publisher: item.publisher,
    publishedAt: item.publishedAt,
    collectedAt: item.collectedAt,
    matchedKeywords: item.matchedKeywords,
    issueTags: item.issueTags,
    personTags: item.personTags,
    sourceType: item.sourceType,
    relevanceScore: item.relevanceScore,
    relevanceTier: item.relevanceTier,
    labels: item.labels,
    youtube: item.youtube
  };
}

/**
 * Returns the opaque identity used to keep entry-based pagination on one
 * immutable feed view. Collection timestamps remain separate display metadata.
 */
export function getFeedContentRevision(
  items: readonly RadarItem[],
  storyClusters: StoryClusterFile
): string {
  const content = JSON.stringify({
    version: FEED_CONTENT_REVISION_VERSION,
    items: [...items].sort(compareIds).map(toFeedRevisionItem),
    storyClusters: {
      version: storyClusters.version,
      clusters: [...storyClusters.clusters].sort(compareIds)
    }
  });

  return createHash("sha256").update(content, "utf8").digest("hex");
}
