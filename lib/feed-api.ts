import { getFeedRequestSearchParams, type FeedPage } from "./feed-page";
import type { FeedFilters } from "./filter";
import type { SourceLinkPage } from "./source-link-page";

export class FeedSnapshotMismatchError extends Error {
  readonly snapshot?: string;

  constructor(snapshot?: string) {
    super("Feed snapshot did not match the current data snapshot");
    this.name = "FeedSnapshotMismatchError";
    this.snapshot = snapshot;
  }
}

async function fetchPage<T>(
  path: "/api/feed" | "/api/source-links",
  filters: FeedFilters,
  offset: number,
  {
    signal,
    snapshot
  }: {
    signal?: AbortSignal;
    snapshot?: string;
  } = {}
): Promise<T> {
  const params = getFeedRequestSearchParams(filters, { offset, snapshot });
  const response = await fetch(`${path}?${params.toString()}`, { signal });

  if (response.status === 409) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      snapshot?: string;
    } | null;
    if (
      body?.error === "feed_snapshot_mismatch" ||
      body?.error === "source_links_snapshot_mismatch"
    ) {
      throw new FeedSnapshotMismatchError(body.snapshot);
    }
  }

  if (!response.ok) {
    throw new Error(`${path === "/api/feed" ? "Feed" : "Source links"} request failed with ${response.status}`);
  }

  const page = (await response.json()) as T & { snapshot: string };

  if (snapshot && page.snapshot !== snapshot) {
    throw new Error("Feed response snapshot did not match the requested snapshot");
  }

  return page;
}

export function fetchFeedPage(
  filters: FeedFilters,
  offset: number,
  options: {
    signal?: AbortSignal;
    snapshot?: string;
  } = {}
): Promise<FeedPage> {
  return fetchPage<FeedPage>("/api/feed", filters, offset, options);
}

export function fetchSourceLinkPage(
  filters: FeedFilters,
  offset: number,
  options: {
    signal?: AbortSignal;
    snapshot?: string;
  } = {}
): Promise<SourceLinkPage> {
  return fetchPage<SourceLinkPage>("/api/source-links", filters, offset, options);
}
