import { getFeedContentRevision } from "./feed-snapshot";
import { toFeedItems, type FeedItem } from "./filter";
import type { DataBundle } from "./schema";
import {
  createStorySimilarityModels,
  type StorySimilarityModels
} from "./story-similarity";

// Server-only: getFeedContentRevision hashes with node:crypto. Client components
// must keep importing lib/feed-page directly.
export type FeedContext = {
  /** Every collected item, projected onto the fields the feed renders. */
  feedItems: FeedItem[];
  /** News and official items only; videos are served by their own feed. */
  editorialFeedItems: FeedItem[];
  /** Pagination identity for one immutable view of the data. */
  revision: string;
  similarityModels: StorySimilarityModels;
};

export function createFeedContext(data: DataBundle): FeedContext {
  const feedItems = toFeedItems(data.items);

  return {
    feedItems,
    editorialFeedItems: feedItems.filter((item) => item.sourceType !== "youtube"),
    revision: getFeedContentRevision(data.items, data.storyClusters),
    similarityModels: createStorySimilarityModels(feedItems)
  };
}

// Every derived value here depends only on the bundle, and the loader hands out
// one bundle object per cached snapshot, so bundle identity is a safe cache key:
// a new snapshot is a new object and gets a new context. Without this the IDF
// corpus was rebuilt on every page render and every /api/feed request.
const feedContexts = new WeakMap<DataBundle, FeedContext>();

export function getFeedContext(data: DataBundle): FeedContext {
  const cached = feedContexts.get(data);
  if (cached) {
    return cached;
  }

  const context = createFeedContext(data);
  feedContexts.set(data, context);
  return context;
}
