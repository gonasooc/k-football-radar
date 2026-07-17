import { getFeedPage, type FeedPage } from "./feed-page";
import {
  defaultFeedFilters,
  type FeedFilters,
  type FeedItem
} from "./filter";
import type { StoryClusterFile } from "./schema";

type ScopedFeedTarget = Partial<Pick<FeedFilters, "issueId" | "personId">>;

export type InitialScopedFeedPage = {
  fixedFilters: FeedFilters;
  initialPage: FeedPage;
};

export function getInitialScopedFeedPage(
  items: readonly FeedItem[],
  target: ScopedFeedTarget = {},
  snapshot = "",
  storyClusters: StoryClusterFile = { version: 1, clusters: [] }
): InitialScopedFeedPage {
  const fixedFilters: FeedFilters = {
    ...defaultFeedFilters,
    scope: "all",
    ...target
  };

  return {
    fixedFilters,
    initialPage: getFeedPage([...items], fixedFilters, { snapshot, storyClusters })
  };
}
