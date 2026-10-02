import assert from "node:assert/strict";
import fs, { mkdtemp, readdir, rm } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { describe, it, mock } from "node:test";
import { setImmediate } from "node:timers/promises";

import { readItemShards, writeItemShards } from "../lib/item-shards";
import type { CollectionState, RadarItem, StoryClusterFile } from "../lib/schema";
import { persistCollectionRun } from "../scripts/collection-run";

function item(id: string, publishedAt: string): RadarItem {
  return {
    id,
    type: "official",
    title: id,
    summary: "공식자료",
    url: `https://example.com/${id}`,
    originalUrl: `https://example.com/${id}`,
    publisher: "테스트기관",
    publishedAt,
    collectedAt: publishedAt,
    matchedKeywords: [],
    issueTags: [],
    personTags: [],
    sourceType: "official",
    isOfficial: true,
    relevanceScore: 50
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function withTempDataDir(run: (dataDir: string) => Promise<void>): Promise<void> {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "kfr-shard-rollback-"));
  try {
    await run(dataDir);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
}

describe("item shard rollback boundary", () => {
  for (const operation of ["rename", "rm"] as const) {
    it(`waits for pending ${operation} operations before collection rollback`, async () => {
      await withTempDataDir(async (dataDir) => {
        const retained = item("retained", "2026-09-29T00:00:00.000Z");
        const affectedItems = operation === "rename"
          ? [item("failed", "2026-10-01T00:00:00.000Z"), item("delayed", "2026-09-30T00:00:00.000Z")]
          : [item("failed", "2026-07-01T00:00:00.000Z"), item("delayed", "2026-07-02T00:00:00.000Z")];
        const existingItems = operation === "rename" ? [retained] : [...affectedItems, retained];
        await writeItemShards(existingItems, dataDir);
        const previousItems = await readItemShards(dataDir);
        const previousFilenames = (await readdir(path.join(dataDir, "items"))).sort();
        const failedPath = path.join(dataDir, "items", `${affectedItems[0].publishedAt.slice(0, 10)}.json`);
        const delayedPath = path.join(dataDir, "items", `${affectedItems[1].publishedAt.slice(0, 10)}.json`);
        const failure = new Error(`injected ${operation} failure`);
        const failedOperation = deferred();
        const delayedOperationStarted = deferred();
        const releaseDelayedOperation = deferred();
        const delayedOperationFinished = deferred();
        let didFail = false;
        let didDelay = false;

        async function intercept(filePath: string, perform: () => Promise<void>): Promise<void> {
          if (filePath === failedPath && !didFail) {
            didFail = true;
            await delayedOperationStarted.promise;
            if (operation === "rm") failedOperation.resolve();
            throw failure;
          }
          if (filePath === delayedPath && !didDelay) {
            didDelay = true;
            delayedOperationStarted.resolve();
            await releaseDelayedOperation.promise;
            try {
              await perform();
            } finally {
              delayedOperationFinished.resolve();
            }
            return;
          }
          await perform();
        }

        const realRename = fs.rename;
        const realRm = fs.rm;
        const interceptRename: typeof fs.rename = (oldPath, newPath) =>
          intercept(newPath.toString(), () => realRename(oldPath, newPath));
        const interceptRemove: typeof fs.rm = (filePath, options) =>
          intercept(filePath.toString(), () => realRm(filePath, options));
        const operationMock = operation === "rename"
          ? mock.method(fs, "rename", interceptRename)
          : mock.method(fs, "rm", interceptRemove);
        // A failed atomic rename first awaits temporary-file cleanup. Observe
        // that completion before checking whether rollback was started early.
        const observeCleanup: typeof fs.rm = async (filePath, options) => {
          await realRm(filePath, options);
          if (filePath.toString().startsWith(`${failedPath}.`)) failedOperation.resolve();
        };
        const cleanupMock = operation === "rename"
          ? mock.method(fs, "rm", observeCleanup)
          : undefined;
        syncBuiltinESMExports();

        const previousState: CollectionState = {
          lastCollectedAt: "2026-10-01T00:00:00.000Z",
          lastRunStatus: "success",
          lastRunNewItems: 0,
          totalItems: existingItems.length
        };
        const previousClusters: StoryClusterFile = { version: 1, clusters: [] };
        let storedState = previousState;
        let storedClusters = previousClusters;
        let itemWriteCalls = 0;
        let persistenceSettled = false;
        const outcome = persistCollectionRun({
          existingItems,
          results: [{
            items: operation === "rename" ? affectedItems : [],
            attempted: 1,
            succeeded: 1,
            failed: 0
          }],
          now: new Date("2026-10-02T00:00:00.000Z"),
          persistence: {
            readCollectionState: async () => storedState,
            readStoryClusters: async () => storedClusters,
            writeItems: async (items) => {
              itemWriteCalls += 1;
              await writeItemShards(items, dataDir);
            },
            writeCollectionState: async (state) => { storedState = state; },
            writeStoryClusters: async (clusters) => { storedClusters = clusters; }
          }
        }).then(
          () => { persistenceSettled = true; },
          (error: unknown) => { persistenceSettled = true; return error; }
        );

        try {
          await failedOperation.promise;
          await setImmediate();
          assert.equal(itemWriteCalls, 1, "rollback must wait for the pending mutation");
          assert.equal(persistenceSettled, false);

          releaseDelayedOperation.resolve();
          assert.strictEqual(await outcome, failure, "the original error must be preserved");
          await delayedOperationFinished.promise;
          assert.equal(itemWriteCalls, 2);
          assert.deepEqual(await readItemShards(dataDir), previousItems);
          assert.deepEqual((await readdir(path.join(dataDir, "items"))).sort(), previousFilenames);
          assert.deepEqual(storedState, previousState);
          assert.deepEqual(storedClusters, previousClusters);
        } finally {
          releaseDelayedOperation.resolve();
          await outcome;
          await delayedOperationFinished.promise;
          operationMock.mock.restore();
          cleanupMock?.mock.restore();
          syncBuiltinESMExports();
        }
      });
    });
  }

  it("preserves all concurrent shard write failures", async () => {
    await withTempDataDir(async (dataDir) => {
      const firstFailure = new Error("first rename failed");
      const secondFailure = new Error("second rename failed");
      const failRename: typeof fs.rename = async (_oldPath, newPath) => {
        throw newPath.toString().endsWith("2026-10-01.json") ? firstFailure : secondFailure;
      };
      const renameMock = mock.method(fs, "rename", failRename);
      syncBuiltinESMExports();
      try {
        await assert.rejects(
          writeItemShards([
            item("first", "2026-10-01T00:00:00.000Z"),
            item("second", "2026-09-30T00:00:00.000Z")
          ], dataDir),
          (error: unknown) => {
            assert.ok(error instanceof AggregateError);
            assert.deepEqual(error.errors, [firstFailure, secondFailure]);
            return true;
          }
        );
        assert.deepEqual(await readdir(path.join(dataDir, "items")), []);
      } finally {
        renameMock.mock.restore();
        syncBuiltinESMExports();
      }
    });
  });
});
