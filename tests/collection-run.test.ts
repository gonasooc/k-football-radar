import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  getBlockingCollectorFailures,
  getCollectionRunStatus,
  hasCompleteCollectorFailure,
  persistCollectionRun,
  prepareCollectionRun,
  type CollectionRunPersistence,
  type CollectorRunResult
} from "../scripts/collection-run";
import type { CollectionState, RadarItem, StoryClusterFile } from "../lib/schema";

function item(id: string, publishedAt = "2026-07-12T00:00:00.000Z"): RadarItem {
  return {
    id,
    type: "official",
    title: id,
    summary: "collection run test",
    url: `https://example.com/${id}`,
    originalUrl: `https://example.com/${id}`,
    publisher: "test source",
    publishedAt,
    collectedAt: publishedAt,
    matchedKeywords: [],
    issueTags: [],
    personTags: [],
    sourceType: "official",
    isOfficial: true,
    relevanceScore: 10
  };
}

function result(override: Partial<CollectorRunResult>): CollectorRunResult {
  return {
    items: [],
    attempted: 1,
    succeeded: 1,
    failed: 0,
    ...override
  };
}

describe("collection run state", () => {
  it("marks total outages failed and partial outages partial", () => {
    assert.equal(
      getCollectionRunStatus([result({ succeeded: 0, failed: 1 })]),
      "failed"
    );
    assert.equal(
      getCollectionRunStatus([
        result({ succeeded: 0, failed: 1 }),
        result({ succeeded: 1, failed: 0 })
      ]),
      "partial"
    );
    assert.equal(getCollectionRunStatus([result({})]), "success");
    assert.equal(getCollectionRunStatus([]), "failed");
  });

  it("flags a collector that attempted work but completed nothing", () => {
    assert.equal(
      hasCompleteCollectorFailure(result({ attempted: 100, succeeded: 0, failed: 100 })),
      true
    );
    assert.equal(
      hasCompleteCollectorFailure(result({ attempted: 100, succeeded: 1, failed: 99 })),
      false
    );
    assert.equal(
      hasCompleteCollectorFailure(result({ attempted: 0, succeeded: 0, failed: 0 })),
      false
    );
  });

  it("only blocks a combined run for collectors configured as blocking", () => {
    const completeFailure = result({ attempted: 3, succeeded: 0, failed: 3 });

    assert.deepEqual(
      getBlockingCollectorFailures([
        {
          name: "naver",
          result: completeFailure,
          blocksCombinedRun: true
        },
        {
          name: "official",
          result: completeFailure,
          blocksCombinedRun: false
        }
      ]),
      ["naver"]
    );
    assert.deepEqual(
      getBlockingCollectorFailures([
        {
          name: "official",
          result: completeFailure,
          blocksCombinedRun: false
        }
      ]),
      []
    );
  });

  it("keeps a combined run partial when every official source fails once", () => {
    const naverResult = result({ attempted: 100, succeeded: 100, failed: 0 });
    const officialResult = result({ attempted: 3, succeeded: 0, failed: 3 });

    assert.equal(getCollectionRunStatus([naverResult, officialResult]), "partial");
    assert.deepEqual(
      getBlockingCollectorFailures([
        {
          name: "naver",
          result: naverResult,
          blocksCombinedRun: true
        },
        {
          name: "official",
          result: officialResult,
          blocksCombinedRun: false
        }
      ]),
      []
    );
  });

  it("keeps standalone items and state totals consistent after a failed run", () => {
    const existingItem = item("existing");
    const previousState: CollectionState = {
      lastCollectedAt: "2026-07-12T08:00:00.000Z",
      lastRunStatus: "success",
      lastRunNewItems: 1,
      totalItems: 1
    };
    const update = prepareCollectionRun({
      existingItems: [existingItem],
      results: [result({ succeeded: 0, failed: 1 })],
      now: new Date("2026-07-13T00:00:00.000Z"),
      previousState
    });

    assert.deepEqual(update.items, [existingItem]);
    assert.deepEqual(update.state, {
      lastCollectedAt: previousState.lastCollectedAt,
      lastRunStatus: "failed",
      lastRunNewItems: 0,
      totalItems: update.items.length
    });
  });

  it("merges successful items while retaining existing items on a partial run", () => {
    const update = prepareCollectionRun({
      existingItems: [item("existing")],
      results: [
        result({
          items: [item("new", "2026-07-12T01:00:00.000Z")],
          attempted: 2,
          succeeded: 1,
          failed: 1
        })
      ],
      now: new Date("2026-07-13T00:00:00.000Z")
    });

    assert.deepEqual(
      new Set(update.items.map((record) => record.id)),
      new Set(["existing", "new"])
    );
    assert.equal(update.state.lastRunStatus, "partial");
    assert.equal(update.state.lastRunNewItems, 1);
    assert.equal(update.state.totalItems, update.items.length);
  });

  it("does not count a known group as new when its representative ID changes", () => {
    const existingItem = item("existing");
    const replacement = {
      ...existingItem,
      id: "replacement",
      url: "https://mirror.example.com/replacement",
      originalUrl: "https://mirror.example.com/replacement",
      collectedAt: "2026-07-13T00:00:00.000Z"
    };
    const update = prepareCollectionRun({
      existingItems: [existingItem],
      results: [result({ items: [replacement] })],
      now: new Date("2026-07-13T01:00:00.000Z")
    });

    assert.equal(update.items.length, 1);
    assert.equal(update.items[0].id, "replacement");
    assert.equal(update.items[0].collectedAt, existingItem.collectedAt);
    assert.equal(update.state.lastRunNewItems, 0);
  });

  it("replaces stale classification metadata when a known URL is recollected", () => {
    const existingItem: RadarItem = {
      ...item("existing"),
      type: "news",
      sourceType: "news",
      isOfficial: false,
      matchedKeywords: ["오래된 강한 근거"],
      issueTags: ["stale-issue"],
      personTags: ["stale-person"],
      relevanceScore: 95,
      labels: ["오래된 라벨"]
    };
    const recollectedItem: RadarItem = {
      ...existingItem,
      id: "recollected",
      title: "재수집된 대표 제목",
      summary: "현재 검색 스니펫",
      url: `${existingItem.url}?utm_source=naver`,
      collectedAt: "2026-07-13T00:00:00.000Z",
      matchedKeywords: ["현재 기사 근거"],
      issueTags: ["current-issue"],
      personTags: [],
      relevanceScore: 25,
      relevanceTier: "secondary",
      labels: ["현재 라벨"]
    };

    const update = prepareCollectionRun({
      existingItems: [existingItem],
      results: [result({ items: [recollectedItem] })],
      now: new Date("2026-07-13T01:00:00.000Z")
    });

    assert.equal(update.items.length, 1);
    assert.equal(update.items[0].id, recollectedItem.id);
    assert.equal(update.items[0].collectedAt, existingItem.collectedAt);
    assert.deepEqual(
      {
        matchedKeywords: update.items[0].matchedKeywords,
        issueTags: update.items[0].issueTags,
        personTags: update.items[0].personTags,
        labels: update.items[0].labels,
        relevanceScore: update.items[0].relevanceScore,
        relevanceTier: update.items[0].relevanceTier
      },
      {
        matchedKeywords: recollectedItem.matchedKeywords,
        issueTags: recollectedItem.issueTags,
        personTags: recollectedItem.personTags,
        labels: recollectedItem.labels,
        relevanceScore: recollectedItem.relevanceScore,
        relevanceTier: recollectedItem.relevanceTier
      }
    );
    assert.equal(update.state.lastRunNewItems, 0);
  });

  it("counts a distinct new group even when it shares an existing collection time", () => {
    const existingItem = item("existing");
    const newItem = item("new");
    const update = prepareCollectionRun({
      existingItems: [existingItem],
      results: [result({ items: [newItem] })],
      now: new Date("2026-07-13T01:00:00.000Z")
    });

    assert.equal(update.items.length, 2);
    assert.equal(update.state.lastRunNewItems, 1);
  });

  it("persists a failed run without advancing the last successful collection time", async () => {
    const existingItems = [item("existing")];
    const previousState: CollectionState = {
      lastCollectedAt: "2026-07-12T08:00:00.000Z",
      lastRunStatus: "success",
      lastRunNewItems: 1,
      totalItems: 1
    };
    let storedItems = existingItems;
    let storedState = previousState;
    let storedStoryClusters: StoryClusterFile = { version: 1, clusters: [] };
    const persistence: CollectionRunPersistence = {
      readCollectionState: async () => storedState,
      readStoryClusters: async () => storedStoryClusters,
      writeItems: async (items) => {
        storedItems = items;
      },
      writeStoryClusters: async (storyClusters) => {
        storedStoryClusters = storyClusters;
      },
      writeCollectionState: async (state) => {
        storedState = state;
      }
    };

    const update = await persistCollectionRun({
      existingItems,
      results: [result({ succeeded: 0, failed: 1 })],
      now: new Date("2026-07-13T00:00:00.000Z"),
      persistence
    });

    assert.deepEqual(storedItems, existingItems);
    assert.equal(update.state.lastCollectedAt, previousState.lastCollectedAt);
    assert.deepEqual(storedState, {
      ...previousState,
      lastRunStatus: "failed",
      lastRunNewItems: 0
    });
  });

  it("rolls back items and state when persistence fails after writing", async () => {
    const existingItems = [item("existing")];
    const previousState: CollectionState = {
      lastCollectedAt: "2026-07-12T08:00:00.000Z",
      lastRunStatus: "success",
      lastRunNewItems: 1,
      totalItems: 1
    };
    let storedItems = existingItems;
    let storedState = previousState;
    let storedStoryClusters: StoryClusterFile = { version: 1, clusters: [] };
    let failNextStateWrite = true;
    const persistence: CollectionRunPersistence = {
      readCollectionState: async () => storedState,
      readStoryClusters: async () => storedStoryClusters,
      writeItems: async (items) => {
        storedItems = items;
      },
      writeStoryClusters: async (storyClusters) => {
        storedStoryClusters = storyClusters;
      },
      writeCollectionState: async (state) => {
        storedState = state;
        if (failNextStateWrite) {
          failNextStateWrite = false;
          throw new Error("injected state write failure");
        }
      }
    };

    await assert.rejects(
      persistCollectionRun({
        existingItems,
        results: [result({ items: [item("new")] })],
        now: new Date("2026-07-13T00:00:00.000Z"),
        persistence
      }),
      /injected state write failure/
    );
    assert.deepEqual(storedItems, existingItems);
    assert.deepEqual(storedStoryClusters, { version: 1, clusters: [] });
    assert.deepEqual(storedState, previousState);
  });

  it("rolls back items, clusters, and state when cluster persistence fails", async () => {
    const existingItems = [item("existing")];
    const previousState: CollectionState = {
      lastCollectedAt: "2026-07-12T08:00:00.000Z",
      lastRunStatus: "success",
      lastRunNewItems: 1,
      totalItems: 1
    };
    const previousStoryClusters: StoryClusterFile = { version: 1, clusters: [] };
    let storedItems = existingItems;
    let storedState = previousState;
    let storedStoryClusters = previousStoryClusters;
    let failNextClusterWrite = true;
    const persistence: CollectionRunPersistence = {
      readCollectionState: async () => storedState,
      readStoryClusters: async () => storedStoryClusters,
      writeItems: async (items) => {
        storedItems = items;
      },
      writeStoryClusters: async (storyClusters) => {
        if (failNextClusterWrite) {
          failNextClusterWrite = false;
          throw new Error("injected cluster write failure");
        }
        storedStoryClusters = storyClusters;
      },
      writeCollectionState: async (state) => {
        storedState = state;
      }
    };

    await assert.rejects(
      persistCollectionRun({
        existingItems,
        results: [result({ items: [item("new")] })],
        now: new Date("2026-07-13T00:00:00.000Z"),
        persistence
      }),
      /injected cluster write failure/
    );
    assert.deepEqual(storedItems, existingItems);
    assert.deepEqual(storedStoryClusters, previousStoryClusters);
    assert.deepEqual(storedState, previousState);
  });
});
