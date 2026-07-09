import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { readItemShards, writeItemShards } from "../lib/item-shards";
import type { RadarItem } from "../lib/schema";

function item(id: string, publishedAt: string): RadarItem {
  return {
    id,
    type: "news",
    title: id,
    summary: "짧은 설명",
    url: `https://example.com/${id}`,
    originalUrl: `https://example.com/${id}`,
    publisher: "테스트뉴스",
    publishedAt,
    collectedAt: "2026-07-09T08:10:00.000Z",
    matchedKeywords: ["대한축구협회"],
    issueTags: [],
    personTags: [],
    sourceType: "news",
    isOfficial: false,
    relevanceScore: 10
  };
}

async function withTempDataDir<T>(run: (dataDir: string) => Promise<T>): Promise<T> {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "kfr-item-shards-"));
  try {
    return await run(dataDir);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
}

describe("item shards", () => {
  it("writes items into daily shards and reads them back latest first", async () => {
    await withTempDataDir(async (dataDir) => {
      await writeItemShards(
        [
          item("older", "2026-07-08T00:00:00.000Z"),
          item("newer", "2026-07-09T00:00:00.000Z")
        ],
        dataDir
      );

      const olderShard = JSON.parse(
        await readFile(path.join(dataDir, "items", "2026-07-08.json"), "utf8")
      ) as RadarItem[];
      const newerShard = JSON.parse(
        await readFile(path.join(dataDir, "items", "2026-07-09.json"), "utf8")
      ) as RadarItem[];

      assert.deepEqual(
        olderShard.map((record) => record.id),
        ["older"]
      );
      assert.deepEqual(
        newerShard.map((record) => record.id),
        ["newer"]
      );
      assert.deepEqual(
        (await readItemShards(dataDir)).map((record) => record.id),
        ["newer", "older"]
      );
    });
  });

  it("removes stale daily shards when no retained item belongs to that day", async () => {
    await withTempDataDir(async (dataDir) => {
      const itemsDir = path.join(dataDir, "items");
      await mkdir(itemsDir, { recursive: true });
      await writeFile(
        path.join(itemsDir, "2026-07-07.json"),
        `${JSON.stringify([item("stale", "2026-07-07T00:00:00.000Z")], null, 2)}\n`,
        "utf8"
      );

      await writeItemShards([item("current", "2026-07-09T00:00:00.000Z")], dataDir);

      await assert.rejects(
        readFile(path.join(itemsDir, "2026-07-07.json"), "utf8"),
        /ENOENT/
      );
      assert.deepEqual(
        (await readItemShards(dataDir)).map((record) => record.id),
        ["current"]
      );
    });
  });
});
