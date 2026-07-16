import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { FeedSnapshotMismatchError, fetchFeedPage } from "../lib/feed-api";
import type { FeedPage } from "../lib/feed-page";
import { defaultFeedFilters } from "../lib/filter";

const originalFetch = globalThis.fetch;

function stubFetch(response: Response): void {
  globalThis.fetch = async () => response;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

const emptyPage: FeedPage = {
  items: [],
  total: 0,
  offset: 0,
  limit: 30,
  hasMore: false,
  snapshot: "2026-07-16T00:00:00.000Z"
};

describe("fetchFeedPage", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the parsed page on success", async () => {
    stubFetch(jsonResponse(emptyPage));

    const page = await fetchFeedPage(defaultFeedFilters, 0);

    assert.deepEqual(page, emptyPage);
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
