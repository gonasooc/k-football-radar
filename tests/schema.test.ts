import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  radarItemSchema,
  youtubeChannelPolicyFileSchema
} from "../lib/schema";

const validRadarItem = {
  id: "item_ok",
  type: "news",
  title: "뉴스",
  summary: "짧은 설명",
  url: "https://example.com/news",
  originalUrl: "https://example.com/news",
  publisher: "테스트뉴스",
  publishedAt: "2026-07-07T00:00:00.000Z",
  collectedAt: "2026-07-07T00:00:00.000Z",
  matchedKeywords: ["대한축구협회"],
  issueTags: [],
  personTags: [],
  sourceType: "news",
  isOfficial: false,
  relevanceScore: 10
} as const;

describe("radarItemSchema", () => {
  it("rejects non-http original links", () => {
    const result = radarItemSchema.safeParse({
      ...validRadarItem,
      url: "javascript:void(0);",
      originalUrl: "javascript:void(0);",
      type: "official",
      sourceType: "official",
      isOfficial: true
    });

    assert.equal(result.success, false);
  });

  it("accepts primary-compatible items and secondary relevance tiers", () => {
    assert.equal(radarItemSchema.safeParse(validRadarItem).success, true);
    assert.equal(
      radarItemSchema.safeParse({
        ...validRadarItem,
        relevanceTier: "secondary"
      }).success,
      true
    );
  });

  it("keeps discovery queries separate from semantic keyword matches", () => {
    const parsed = radarItemSchema.parse({
      ...validRadarItem,
      matchedKeywords: ["대한축구협회"],
      discoveryQueries: ["축구협회 회장 선거"]
    });

    assert.deepEqual(parsed.matchedKeywords, ["대한축구협회"]);
    assert.deepEqual(parsed.discoveryQueries, ["축구협회 회장 선거"]);
  });

  it("rejects unknown relevance tiers", () => {
    assert.equal(
      radarItemSchema.safeParse({
        ...validRadarItem,
        relevanceTier: "tertiary"
      }).success,
      false
    );
  });

  it("requires complete metadata for YouTube items and forbids it elsewhere", () => {
    const youtubeItem = {
      ...validRadarItem,
      id: "youtube_video-1",
      type: "youtube",
      sourceType: "youtube",
      url: "https://www.youtube.com/watch?v=video-1",
      originalUrl: "https://www.youtube.com/watch?v=video-1",
      youtube: {
        videoId: "video-1",
        channelId: "channel-1",
        channelStatus: "preferred",
        contentRelevanceTier: "primary",
        thumbnail: {
          url: "https://i.ytimg.com/vi/video-1/hqdefault.jpg",
          width: 480,
          height: 360
        },
        durationSeconds: 75
      }
    };

    assert.equal(radarItemSchema.safeParse(youtubeItem).success, true);
    assert.equal(
      radarItemSchema.safeParse({
        ...youtubeItem,
        youtube: { ...youtubeItem.youtube, channelStatus: "blocked" }
      }).success,
      false
    );
    assert.equal(
      radarItemSchema.safeParse({ ...youtubeItem, youtube: undefined }).success,
      false
    );
    assert.equal(
      radarItemSchema.safeParse({ ...validRadarItem, youtube: youtubeItem.youtube }).success,
      false
    );
  });
});

describe("youtubeChannelPolicyFileSchema", () => {
  it("accepts channel-ID-only preferred and blocked lists", () => {
    assert.deepEqual(
      youtubeChannelPolicyFileSchema.parse({
        version: 1,
        preferred: ["preferred-channel"],
        blocked: ["blocked-channel"]
      }),
      {
        version: 1,
        preferred: ["preferred-channel"],
        blocked: ["blocked-channel"]
      }
    );
  });

  it("rejects duplicate IDs and overlap between the two lists", () => {
    assert.equal(
      youtubeChannelPolicyFileSchema.safeParse({
        version: 1,
        preferred: ["same-channel", "same-channel"],
        blocked: []
      }).success,
      false
    );
    assert.equal(
      youtubeChannelPolicyFileSchema.safeParse({
        version: 1,
        preferred: ["same-channel"],
        blocked: ["same-channel"]
      }).success,
      false
    );
  });
});
