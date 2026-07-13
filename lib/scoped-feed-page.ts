import { getFeedPage, type FeedPage } from "./feed-page";
import {
  defaultFeedFilters,
  type FeedFilters,
  type FeedItem
} from "./filter";

type ScopedFeedTarget = Partial<Pick<FeedFilters, "issueId" | "personId">>;

export type InitialScopedFeedPage = {
  fixedFilters: FeedFilters;
  initialPage: FeedPage;
};

export function getInitialScopedFeedPage(
  items: readonly FeedItem[],
  target: ScopedFeedTarget = {},
  snapshot = ""
): InitialScopedFeedPage {
  const fixedFilters: FeedFilters = {
    ...defaultFeedFilters,
    scope: "all",
    ...target
  };

  return {
    fixedFilters,
    initialPage: getFeedPage([...items], fixedFilters, { snapshot })
  };
}
