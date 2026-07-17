import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GET } from "../app/api/feed/route";
import { GET as GET_SOURCE_LINKS } from "../app/api/source-links/route";
import { getDataBundle } from "../lib/data";
import { getFeedContentRevision } from "../lib/feed-snapshot";

describe("feed API snapshot boundary", () => {
  it("returns the current snapshot on a first-page response", async () => {
    const data = await getDataBundle();
    const currentSnapshot = getFeedContentRevision(data.items, data.storyClusters);
    const response = await GET(new Request("http://localhost/api/feed"));
    const page = await response.json();

    assert.equal(response.status, 200);
    assert.equal(page.snapshot, currentSnapshot);
    assert.equal(page.offset, 0);
    assert.equal(page.limit, 30);
    assert.ok(Array.isArray(page.entries));
    assert.equal(typeof page.totalEntries, "number");
    assert.equal(typeof page.totalItems, "number");
    assert.equal("items" in page, false);
  });

  it("rejects missing or stale snapshots on later pages", async () => {
    const data = await getDataBundle();
    const currentSnapshot = getFeedContentRevision(data.items, data.storyClusters);
    const missingResponse = await GET(new Request("http://localhost/api/feed?offset=30"));
    const staleResponse = await GET(
      new Request("http://localhost/api/feed?offset=30&snapshot=older")
    );
    const currentResponse = await GET(
      new Request(
        `http://localhost/api/feed?offset=30&snapshot=${encodeURIComponent(currentSnapshot)}`
      )
    );

    assert.equal(missingResponse.status, 409);
    assert.equal(staleResponse.status, 409);
    assert.equal((await staleResponse.json()).error, "feed_snapshot_mismatch");
    assert.equal(currentResponse.status, 200);
    assert.equal((await currentResponse.json()).snapshot, currentSnapshot);
  });

  it("keeps source-link pagination on the dedicated raw endpoint", async () => {
    const data = await getDataBundle();
    const currentSnapshot = getFeedContentRevision(data.items, data.storyClusters);
    const firstResponse = await GET_SOURCE_LINKS(
      new Request("http://localhost/api/source-links?scope=all")
    );
    const firstPage = await firstResponse.json();

    assert.equal(firstResponse.status, 200);
    assert.equal(firstPage.snapshot, currentSnapshot);
    assert.equal(firstPage.offset, 0);
    assert.equal(firstPage.items.length, 30);
    assert.ok(firstPage.total >= firstPage.items.length);
    assert.equal("entries" in firstPage, false);

    const staleResponse = await GET_SOURCE_LINKS(
      new Request("http://localhost/api/source-links?scope=all&offset=30&snapshot=older")
    );
    assert.equal(staleResponse.status, 409);
    assert.equal((await staleResponse.json()).error, "source_links_snapshot_mismatch");
  });
});
