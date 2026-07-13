import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { CollectionState } from "../lib/schema";

describe("data JSON writes", () => {
  it("atomically replaces collection state without leaving temporary files", async () => {
    const originalCwd = process.cwd();
    const workspace = await mkdtemp(path.join(os.tmpdir(), "kfr-data-io-"));
    const dataDir = path.join(workspace, "data");
    const state: CollectionState = {
      lastCollectedAt: "2026-07-13T00:00:00.000Z",
      lastRunStatus: "success",
      lastRunNewItems: 2,
      totalItems: 10
    };

    try {
      await mkdir(dataDir);
      await writeFile(
        path.join(dataDir, "collection-state.json"),
        `${JSON.stringify({ ...state, totalItems: 1 }, null, 2)}\n`,
        "utf8"
      );
      process.chdir(workspace);
      const { writeCollectionState } = await import(`../scripts/data-io.ts?cwd=${Date.now()}`);

      await writeCollectionState(state);

      assert.deepEqual(
        JSON.parse(await readFile(path.join(dataDir, "collection-state.json"), "utf8")),
        state
      );
      assert.deepEqual(await readdir(dataDir), ["collection-state.json"]);
    } finally {
      process.chdir(originalCwd);
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
