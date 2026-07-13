import { getFeedRequestSearchParams, type FeedPage } from "./feed-page";
import type { FeedFilters } from "./filter";

export async function fetchFeedPage(
  filters: FeedFilters,
  offset: number,
  {
    signal,
    snapshot
  }: {
    signal?: AbortSignal;
    snapshot?: string;
  } = {}
): Promise<FeedPage> {
  const params = getFeedRequestSearchParams(filters, { offset, snapshot });
  const response = await fetch(`/api/feed?${params.toString()}`, { signal });

  if (!response.ok) {
    throw new Error(`Feed request failed with ${response.status}`);
  }

  const page = (await response.json()) as FeedPage;

  if (snapshot && page.snapshot !== snapshot) {
    throw new Error("Feed response snapshot did not match the requested snapshot");
  }

  return page;
}
