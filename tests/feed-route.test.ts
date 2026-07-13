import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GET } from "../app/api/feed/route";
import { getDataBundle } from "../lib/data";

describe("feed API snapshot boundary", () => {
  it("returns the current snapshot on a first-page response", async () => {
    const currentSnapshot = getDataBundle().collectionState.lastCollectedAt;
    const response = GET(new Request("http://localhost/api/feed"));
    const page = await response.json();

    assert.equal(response.status, 200);
    assert.equal(page.snapshot, currentSnapshot);
    assert.equal(page.offset, 0);
    assert.equal(page.limit, 30);
  });

  it("rejects missing or stale snapshots on later pages", async () => {
    const currentSnapshot = getDataBundle().collectionState.lastCollectedAt;
    const missingResponse = GET(new Request("http://localhost/api/feed?offset=30"));
    const staleResponse = GET(
      new Request("http://localhost/api/feed?offset=30&snapshot=older")
    );
    const currentResponse = GET(
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
});
