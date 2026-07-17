import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDataBundle } from "../lib/data";
import {
  normalizeDataBundle,
  parseDataSnapshot,
  serializeDataSnapshot
} from "../lib/data-snapshot";
import { createRemoteDataLoader } from "../lib/remote-data";

describe("R2 data snapshots", () => {
  it("defaults old snapshots without story relationships to an empty v1 file", async () => {
    const oldBundle: Partial<Awaited<ReturnType<typeof getDataBundle>>> = {
      ...(await getDataBundle())
    };
    delete oldBundle.storyClusters;

    assert.deepEqual(normalizeDataBundle(oldBundle).storyClusters, {
      version: 1,
      clusters: []
    });
  });

  it("creates a content-addressed manifest and validates the snapshot", async () => {
    const bundle = await getDataBundle();
    const first = serializeDataSnapshot(bundle);
    const second = serializeDataSnapshot(bundle);

    assert.deepEqual(first, second);
    assert.equal(first.manifest.objectKey, `snapshots/${first.manifest.sha256}.json`);
    assert.deepEqual(parseDataSnapshot(first.body, first.manifest), bundle);
  });

  it("rejects a snapshot whose bytes do not match its manifest", async () => {
    const snapshot = serializeDataSnapshot(await getDataBundle());

    assert.throws(
      () => parseDataSnapshot(`${snapshot.body} `, snapshot.manifest),
      /size mismatch/
    );
  });

  it("rejects a manifest that points at the wrong content-addressed object", async () => {
    const snapshot = serializeDataSnapshot(await getDataBundle());

    assert.throws(
      () =>
        parseDataSnapshot(snapshot.body, {
          ...snapshot.manifest,
          objectKey: `${"snapshots/"}${"0".repeat(64)}.json`
        }),
      /object key/
    );
  });

  it("caches a valid R2 snapshot and refreshes it after the TTL", async () => {
    const snapshot = serializeDataSnapshot(await getDataBundle());
    let now = 1_000;
    let requests = 0;
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      requests += 1;
      const pathname = new URL(input instanceof Request ? input.url : input).pathname;
      if (pathname.endsWith("/current.json")) {
        return Response.json(snapshot.manifest);
      }
      if (pathname.endsWith(`/${snapshot.manifest.objectKey}`)) {
        return new Response(snapshot.body, { status: 200 });
      }
      return new Response(null, { status: 404 });
    };
    const loader = createRemoteDataLoader({
      baseUrl: "https://data.example.com",
      cacheTtlMs: 1_000,
      fetchImpl,
      now: () => now
    });

    const first = await loader.getDataBundle();
    const cached = await loader.getDataBundle();
    assert.equal(requests, 2);
    assert.strictEqual(cached, first);

    now += 1_001;
    const refreshed = await loader.getDataBundle();
    assert.equal(requests, 3);
    assert.strictEqual(refreshed, first);
    assert.equal(loader.getStatus().stale, false);
  });

  it("downloads a new snapshot only when current.json changes", async () => {
    const bundle = await getDataBundle();
    const firstSnapshot = serializeDataSnapshot(bundle);
    const secondSnapshot = serializeDataSnapshot({
      ...bundle,
      collectionState: {
        ...bundle.collectionState,
        lastCollectedAt: "2026-07-15T12:00:00.000Z"
      }
    });
    let currentSnapshot = firstSnapshot;
    let now = 1_000;
    let requests = 0;
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      requests += 1;
      const pathname = new URL(input instanceof Request ? input.url : input).pathname;
      if (pathname.endsWith("/current.json")) {
        return Response.json(currentSnapshot.manifest);
      }
      const snapshot = [firstSnapshot, secondSnapshot].find(({ manifest }) =>
        pathname.endsWith(`/${manifest.objectKey}`)
      );
      return snapshot
        ? new Response(snapshot.body, { status: 200 })
        : new Response(null, { status: 404 });
    };
    const loader = createRemoteDataLoader({
      baseUrl: "https://data.example.com",
      cacheTtlMs: 1_000,
      fetchImpl,
      now: () => now
    });

    await loader.getDataBundle();
    currentSnapshot = secondSnapshot;
    now += 1_001;
    const refreshed = await loader.getDataBundle();

    assert.equal(requests, 4);
    assert.equal(
      refreshed.collectionState.lastCollectedAt,
      secondSnapshot.manifest.collectedAt
    );
  });

  it("serves the last valid snapshot when an R2 refresh fails", async () => {
    const snapshot = serializeDataSnapshot(await getDataBundle());
    let now = 1_000;
    let fail = false;
    const errors: string[] = [];
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      if (fail) {
        return new Response(null, { status: 503 });
      }
      const pathname = new URL(input instanceof Request ? input.url : input).pathname;
      return pathname.endsWith("/current.json")
        ? Response.json(snapshot.manifest)
        : new Response(snapshot.body, { status: 200 });
    };
    const loader = createRemoteDataLoader({
      baseUrl: "https://data.example.com",
      cacheTtlMs: 1_000,
      fetchImpl,
      now: () => now,
      onRefreshError: (message) => errors.push(message)
    });

    const current = await loader.getDataBundle();
    now += 1_001;
    fail = true;
    const stale = await loader.getDataBundle();

    assert.strictEqual(stale, current);
    assert.equal(loader.getStatus().stale, true);
    assert.match(loader.getStatus().lastError ?? "", /status 503/);
    assert.equal(errors.length, 1);
  });
});
