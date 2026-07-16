import { getFeedRequestSearchParams, type FeedPage } from "./feed-page";
import type { FeedFilters } from "./filter";

export class FeedSnapshotMismatchError extends Error {
  readonly snapshot?: string;

  constructor(snapshot?: string) {
    super("Feed snapshot did not match the current data snapshot");
    this.name = "FeedSnapshotMismatchError";
    this.snapshot = snapshot;
  }
}

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

  if (response.status === 409) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      snapshot?: string;
    } | null;
    if (body?.error === "feed_snapshot_mismatch") {
      throw new FeedSnapshotMismatchError(body.snapshot);
    }
  }

  if (!response.ok) {
    throw new Error(`Feed request failed with ${response.status}`);
  }

  const page = (await response.json()) as FeedPage;

  if (snapshot && page.snapshot !== snapshot) {
    throw new Error("Feed response snapshot did not match the requested snapshot");
  }

  return page;
}
