import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RadarItem, StoryClusterFile } from "../lib/schema";
import { buildStoryClusters, getStoryClusterId } from "../lib/story-clusters";
import { validateStoryClusters } from "../lib/validation";

function item(id: string, override: Partial<RadarItem> = {}): RadarItem {
  const publishedAt = override.publishedAt ?? "2026-07-16T00:00:00.000Z";
  return {
    id,
    type: "news",
    title: "대한축구협회 청문회 일정 연기",
    summary: "국회가 대한축구협회 청문회 일정을 연기했다",
    url: `https://example.com/${id}`,
    originalUrl: `https://example.com/${id}`,
    publisher: "테스트뉴스",
    publishedAt,
    collectedAt: publishedAt,
    matchedKeywords: [],
    issueTags: ["hearing"],
    personTags: [],
    sourceType: "news",
    isOfficial: false,
    relevanceScore: 50,
    ...override
  };
}

function youtubeItem(id: string, override: Partial<RadarItem> = {}): RadarItem {
  return {
    ...item(id, override),
    type: "youtube",
    sourceType: "youtube",
    publisher: override.publisher ?? "테스트채널",
    youtube: {
      videoId: `video-${id}`,
      channelId: `channel-${id}`,
      thumbnail: {
        url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        width: 480,
        height: 360
      },
      durationSeconds: 600
    }
  };
}

describe("story cluster validation", () => {
  it("accepts a deterministically rebuilt cluster file", () => {
    const items = [
      item("a"),
      item("b", { publishedAt: "2026-07-16T01:00:00.000Z" })
    ];

    assert.doesNotThrow(() => validateStoryClusters(items, buildStoryClusters(items)));
  });

  it("accepts a complete rare-fact burst cluster", () => {
    const items = [
      item("fact-a", {
        title: "대한체육회 선거인단 대폭 확대",
        summary: "선거인단을 41배 늘리는 안건이 통과됐다",
        publisher: "news-a"
      }),
      item("fact-b", {
        title: "체육회 정관 개정 만장일치",
        summary: "현장 구성원 투표권이 종전보다 41배가 된다",
        publisher: "news-b",
        publishedAt: "2026-07-16T01:00:00.000Z"
      }),
      item("fact-c", {
        title: "축구협회 선거 개편 길 열려",
        summary: "상위 기관의 선거인단 규모가 41배 확대됐다",
        publisher: "news-c",
        publishedAt: "2026-07-16T02:00:00.000Z"
      })
    ];
    const clusters = buildStoryClusters(items);

    assert.deepEqual(clusters.clusters[0]?.memberIds, [
      "fact-a",
      "fact-b",
      "fact-c"
    ]);
    assert.doesNotThrow(() => validateStoryClusters(items, clusters));
  });

  it("rejects official members and duplicate assignments", () => {
    const official = item("official", {
      type: "official",
      sourceType: "official",
      isOfficial: true
    });
    const news = item("news", { publishedAt: "2026-07-16T01:00:00.000Z" });
    const officialCluster: StoryClusterFile = {
      version: 1,
      clusters: [
        {
          id: getStoryClusterId("official"),
          seedItemId: "official",
          memberIds: ["official", "news"]
        }
      ]
    };
    assert.throws(
      () => validateStoryClusters([official, news], officialCluster),
      /Official item/
    );

    const items = [
      item("a"),
      item("b", { publishedAt: "2026-07-16T01:00:00.000Z" }),
      item("c", { publishedAt: "2026-07-16T02:00:00.000Z" })
    ];
    const duplicated: StoryClusterFile = {
      version: 1,
      clusters: [
        {
          id: getStoryClusterId("a"),
          seedItemId: "a",
          memberIds: ["a", "b"]
        },
        {
          id: getStoryClusterId("b"),
          seedItemId: "b",
          memberIds: ["b", "c"]
        }
      ]
    };
    assert.throws(
      () => validateStoryClusters(items, duplicated),
      /assigned more than once/
    );
  });

  it("rejects clusters outside the time window or complete-link rule", () => {
    const distantItems = [
      item("old", { publishedAt: "2026-07-14T00:00:00.000Z" }),
      item("current")
    ];
    const distantCluster: StoryClusterFile = {
      version: 1,
      clusters: [
        {
          id: getStoryClusterId("old"),
          seedItemId: "old",
          memberIds: ["old", "current"]
        }
      ]
    };
    assert.throws(
      () => validateStoryClusters(distantItems, distantCluster),
      /36-hour window/
    );

    const chain = [
      item("a", { title: "abcdefghij", publisher: "a" }),
      item("b", {
        title: "efghijklmn",
        publisher: "b",
        publishedAt: "2026-07-16T01:00:00.000Z"
      }),
      item("c", {
        title: "ijklmnopqr",
        publisher: "c",
        publishedAt: "2026-07-16T02:00:00.000Z"
      })
    ];
    const transitiveCluster: StoryClusterFile = {
      version: 1,
      clusters: [
        {
          id: getStoryClusterId("a"),
          seedItemId: "a",
          memberIds: ["a", "b", "c"]
        }
      ]
    };
    assert.throws(
      () => validateStoryClusters(chain, transitiveCluster),
      /complete-link similarity/
    );
  });

  it("accepts a rebuilt YouTube cluster with the 72-hour video window", () => {
    const videos = [
      youtubeItem("video-a", { publisher: "채널 A" }),
      youtubeItem("video-b", {
        publisher: "채널 B",
        publishedAt: "2026-07-18T20:00:00.000Z"
      })
    ];
    const clusters = buildStoryClusters(videos);

    assert.deepEqual(clusters.clusters[0]?.memberIds, ["video-a", "video-b"]);
    assert.doesNotThrow(() => validateStoryClusters(videos, clusters));
  });

  it("rejects clusters that mix news and video items", () => {
    const news = item("news");
    const video = youtubeItem("video", {
      publishedAt: "2026-07-16T01:00:00.000Z"
    });
    const mixedCluster: StoryClusterFile = {
      version: 1,
      clusters: [
        {
          id: getStoryClusterId("news"),
          seedItemId: "news",
          memberIds: ["news", "video"]
        }
      ]
    };

    assert.throws(
      () => validateStoryClusters([news, video], mixedCluster),
      /mixes item types/
    );
  });

  it("rejects video pairs published more than 72 hours apart", () => {
    const videos = [
      youtubeItem("video-a", { publisher: "채널 A" }),
      youtubeItem("video-b", {
        publisher: "채널 B",
        publishedAt: "2026-07-19T00:00:00.001Z"
      })
    ];
    const distantCluster: StoryClusterFile = {
      version: 1,
      clusters: [
        {
          id: getStoryClusterId("video-a"),
          seedItemId: "video-a",
          memberIds: ["video-a", "video-b"]
        }
      ]
    };

    assert.throws(
      () => validateStoryClusters(videos, distantCluster),
      /72-hour window/
    );
  });
});
