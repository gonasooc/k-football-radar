import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  FeedSnapshotMismatchError,
  fetchFeedPage,
  fetchSourceLinkPage
} from "../lib/feed-api";
import type { FeedPage } from "../lib/feed-page";
import { defaultFeedFilters } from "../lib/filter";
import type { SourceLinkPage } from "../lib/source-link-page";

const originalFetch = globalThis.fetch;

function stubFetch(
  response: Response,
  onRequest?: (input: string | URL | Request) => void
): void {
  globalThis.fetch = async (input) => {
    onRequest?.(input);
    return response;
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

const emptyPage: FeedPage = {
  entries: [],
  totalEntries: 0,
  totalItems: 0,
  offset: 0,
  limit: 30,
  hasMore: false,
  snapshot: "2026-07-16T00:00:00.000Z"
};

const emptySourceLinkPage: SourceLinkPage = {
  items: [],
  total: 0,
  offset: 0,
  limit: 30,
  hasMore: false,
  snapshot: "2026-07-16T00:00:00.000Z"
};

describe("feed API clients", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the parsed grouped feed page on success", async () => {
    stubFetch(jsonResponse(emptyPage));

    const page = await fetchFeedPage(defaultFeedFilters, 0);

    assert.deepEqual(page, emptyPage);
  });

  it("uses the dedicated raw source-link endpoint", async () => {
    let requestedUrl = "";
    stubFetch(jsonResponse(emptySourceLinkPage), (input) => {
      requestedUrl = String(input);
    });

    const page = await fetchSourceLinkPage(defaultFeedFilters, 30, {
      snapshot: emptySourceLinkPage.snapshot
    });

    assert.deepEqual(page, emptySourceLinkPage);
    assert.match(requestedUrl, /^\/api\/source-links\?/);
    assert.match(requestedUrl, /offset=30/);
  });

  it("throws a snapshot mismatch error carrying the new snapshot on 409", async () => {
    stubFetch(
      jsonResponse(
        { error: "feed_snapshot_mismatch", snapshot: "2026-07-16T01:00:00.000Z" },
        409
      )
    );

    await assert.rejects(
      fetchFeedPage(defaultFeedFilters, 30, { snapshot: "2026-07-16T00:00:00.000Z" }),
      (error: unknown) => {
        assert.ok(error instanceof FeedSnapshotMismatchError);
        assert.equal(error.snapshot, "2026-07-16T01:00:00.000Z");
        return true;
      }
    );
  });

  it("recognizes source-link snapshot mismatches", async () => {
    stubFetch(
      jsonResponse(
        {
          error: "source_links_snapshot_mismatch",
          snapshot: "2026-07-16T01:00:00.000Z"
        },
        409
      )
    );

    await assert.rejects(
      fetchSourceLinkPage(defaultFeedFilters, 30, {
        snapshot: "2026-07-16T00:00:00.000Z"
      }),
      FeedSnapshotMismatchError
    );
  });

  it("throws a generic error for other failures", async () => {
    stubFetch(jsonResponse({ error: "oops" }, 500));

    await assert.rejects(
      fetchFeedPage(defaultFeedFilters, 0),
      /Feed request failed with 500/
    );
  });

  it("rejects a successful response whose snapshot moved past the requested one", async () => {
    stubFetch(jsonResponse({ ...emptyPage, snapshot: "2026-07-16T02:00:00.000Z" }));

    await assert.rejects(
      fetchFeedPage(defaultFeedFilters, 0, { snapshot: "2026-07-16T00:00:00.000Z" }),
      /did not match the requested snapshot/
    );
  });
});
