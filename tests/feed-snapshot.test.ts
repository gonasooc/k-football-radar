import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasFeedSnapshotMismatch } from "../lib/feed-page";
import { getFeedContentRevision } from "../lib/feed-snapshot";
import type { RadarItem, StoryClusterFile } from "../lib/schema";

function item(id: string, override: Partial<RadarItem> = {}): RadarItem {
  return {
    id,
    type: "news",
    title: `기사 ${id}`,
    summary: "대한축구협회 관련 기사 요약",
    url: `https://example.com/${id}`,
    originalUrl: `https://example.com/${id}`,
    publisher: "테스트뉴스",
    publishedAt: "2026-07-16T00:00:00.000Z",
    collectedAt: "2026-07-16T01:00:00.000Z",
    matchedKeywords: ["대한축구협회"],
    issueTags: [],
    personTags: [],
    sourceType: "news",
    isOfficial: false,
    relevanceScore: 50,
    ...override
  };
}

const emptyClusters: StoryClusterFile = { version: 1, clusters: [] };

describe("feed content revisions", () => {
  it("is deterministic regardless of item and cluster record ordering", () => {
    const items = [item("a"), item("b"), item("c"), item("d")];
    const clusters: StoryClusterFile = {
      version: 1,
      clusters: [
        {
          id: "story_bbbbbbbbbbbbbbbbbbbb",
          seedItemId: "c",
          memberIds: ["c", "d"]
        },
        {
          id: "story_aaaaaaaaaaaaaaaaaaaa",
          seedItemId: "a",
          memberIds: ["a", "b"]
        }
      ]
    };

    assert.equal(
      getFeedContentRevision(items, clusters),
      getFeedContentRevision([...items].reverse(), {
        ...clusters,
        clusters: [...clusters.clusters].reverse()
      })
    );
  });

  it("invalidates later pagination when reclassification changes feed metadata", () => {
    const beforeItems = [item("a"), item("b")];
    const afterItems = [
      beforeItems[0],
      {
        ...beforeItems[1],
        matchedKeywords: ["감독 선임"],
        issueTags: ["coach-appointment"],
        relevanceScore: 85,
        relevanceTier: "secondary" as const,
        labels: ["재분류"]
      }
    ];
    const previousRevision = getFeedContentRevision(beforeItems, emptyClusters);
    const currentRevision = getFeedContentRevision(afterItems, emptyClusters);

    assert.notEqual(currentRevision, previousRevision);
    assert.equal(
      hasFeedSnapshotMismatch(previousRevision, currentRevision, 30),
      true
    );
  });

  it("invalidates later pagination for a cluster-only regrouping", () => {
    const items = [item("a"), item("b")];
    const regrouped: StoryClusterFile = {
      version: 1,
      clusters: [
        {
          id: "story_aaaaaaaaaaaaaaaaaaaa",
          seedItemId: "a",
          memberIds: ["a", "b"]
        }
      ]
    };
    const previousRevision = getFeedContentRevision(items, emptyClusters);
    const currentRevision = getFeedContentRevision(items, regrouped);

    assert.notEqual(currentRevision, previousRevision);
    assert.equal(
      hasFeedSnapshotMismatch(previousRevision, currentRevision, 30),
      true
    );
  });
});
