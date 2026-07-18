import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  Issue,
  RadarItem,
  YouTubeChannelPolicyFile,
  YouTubeFormatCacheFile
} from "../lib/schema";
import {
  getEffectiveYouTubeTier,
  getYouTubeChannelStatus
} from "../lib/youtube-channel-policy";
import { buildYouTubeChannelCandidateReport } from "../lib/youtube-channel-report";
import {
  classifyYouTubeVideoFormat,
  hasExplicitShortsEvidence,
  probeYouTubeVideoFormat
} from "../lib/youtube-shorts";
import { reclassifyExistingYouTubeItems } from "../scripts/reclassify-youtube";

const issues: Issue[] = [
  {
    id: "election",
    name: "회장 선거",
    description: "대한축구협회장 선거",
    keywords: ["회장 선거", "축구협회장"],
    priority: 1
  }
];

function youtubeItem({
  id,
  channelId,
  title = "대한축구협회 회장 선거 분석",
  durationSeconds = 900
}: {
  id: string;
  channelId: string;
  title?: string;
  durationSeconds?: number;
}): RadarItem {
  return {
    id: `youtube_${id}`,
    type: "youtube",
    title,
    summary: "대한축구협회 회장 선거 절차를 분석합니다.",
    url: `https://www.youtube.com/watch?v=${id}`,
    originalUrl: `https://www.youtube.com/watch?v=${id}`,
    publisher: `채널 ${channelId}`,
    publishedAt: "2026-07-17T01:00:00.000Z",
    collectedAt: "2026-07-17T02:00:00.000Z",
    matchedKeywords: ["회장 선거"],
    issueTags: ["election"],
    personTags: [],
    sourceType: "youtube",
    isOfficial: false,
    relevanceScore: 80,
    youtube: {
      videoId: id,
      channelId,
      thumbnail: {
        url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        width: 480,
        height: 360
      },
      durationSeconds
    }
  };
}

function shortsHtml(videoId: string): string {
  const shortsUrl = `https://www.youtube.com/shorts/${videoId}`;
  return `<link rel="canonical" href="${shortsUrl}"><meta property="og:url" content="${shortsUrl}">`;
}

describe("YouTube channel policy", () => {
  it("keeps unlisted as the safe default and requires preferred plus primary for primary exposure", () => {
    const policy: YouTubeChannelPolicyFile = {
      version: 1,
      preferred: [],
      blocked: []
    };
    assert.equal(getYouTubeChannelStatus(policy, "new-channel"), "unlisted");
    assert.equal(
      getEffectiveYouTubeTier({
        channelStatus: "preferred",
        contentRelevanceTier: "primary"
      }),
      "primary"
    );
    assert.equal(
      getEffectiveYouTubeTier({
        channelStatus: "unlisted",
        contentRelevanceTier: "primary"
      }),
      "secondary"
    );
    assert.equal(
      getEffectiveYouTubeTier({
        channelStatus: "preferred",
        contentRelevanceTier: "secondary"
      }),
      "secondary"
    );
    assert.equal(
      getEffectiveYouTubeTier({
        channelStatus: "blocked",
        contentRelevanceTier: "primary"
      }),
      "reject"
    );
  });
});

describe("YouTube Shorts classification", () => {
  it("only treats explicit metadata as deterministic Shorts evidence", () => {
    assert.equal(
      hasExplicitShortsEvidence({
        title: "축구협회 뉴스 #Shorts",
        description: ""
      }),
      true
    );
    assert.equal(
      hasExplicitShortsEvidence({
        title: "짧은 축구협회 뉴스",
        description: "",
        tags: ["쇼츠"]
      }),
      true
    );
    assert.equal(
      hasExplicitShortsEvidence({
        title: "2분 축구협회 뉴스",
        description: ""
      }),
      false
    );
  });

  it("uses the observed redirect contract and fails open for unexpected responses", async () => {
    assert.equal(
      await probeYouTubeVideoFormat({
        videoId: "short-id",
        fetchImpl: async () => new Response(shortsHtml("short-id"), { status: 200 })
      }),
      "shorts"
    );
    assert.equal(
      await probeYouTubeVideoFormat({
        videoId: "regular-id",
        fetchImpl: async () =>
          new Response(null, {
            status: 303,
            headers: {
              Location: "https://www.youtube.com/watch?v=regular-id"
            }
          })
      }),
      "regular"
    );
    assert.equal(
      await probeYouTubeVideoFormat({
        videoId: "unknown-id",
        fetchImpl: async () => new Response(null, { status: 429 })
      }),
      "unknown"
    );
    assert.equal(
      await probeYouTubeVideoFormat({
        videoId: "ambiguous-id",
        fetchImpl: async () => new Response("shorts feed shell", { status: 200 })
      }),
      "unknown"
    );
  });

  it("uses the three-minute Shorts ceiling and caches only deterministic outcomes", async () => {
    const cache: YouTubeFormatCacheFile = { version: 1, entries: {} };
    assert.equal(
      await classifyYouTubeVideoFormat({
        videoId: "short-id",
        durationSeconds: 45,
        title: "축구협회 #숏츠",
        description: "",
        cache,
        redirectProbeEnabled: true,
        fetchImpl: async () => {
          throw new Error("metadata should avoid a request");
        },
        now: new Date("2026-07-18T00:00:00.000Z")
      }),
      "shorts"
    );
    assert.equal(cache.entries["short-id"]?.evidence, "metadata");

    assert.equal(
      await classifyYouTubeVideoFormat({
        videoId: "unknown-id",
        durationSeconds: 120,
        title: "축구협회 영상",
        description: "",
        cache,
        redirectProbeEnabled: true,
        fetchImpl: async () => new Response(null, { status: 503 })
      }),
      "unknown"
    );
    assert.equal(cache.entries["unknown-id"], undefined);

    assert.equal(
      await classifyYouTubeVideoFormat({
        videoId: "long-hashtag-id",
        durationSeconds: 181,
        title: "축구협회 분석 #shorts",
        description: "",
        cache,
        redirectProbeEnabled: true,
        fetchImpl: async () => {
          throw new Error("duration should avoid a request");
        }
      }),
      "regular"
    );
    assert.equal(cache.entries["long-hashtag-id"]?.evidence, "duration");
  });
});

describe("YouTube channel candidate report", () => {
  it("summarizes channels without changing their policy status", () => {
    const policy: YouTubeChannelPolicyFile = {
      version: 1,
      preferred: [],
      blocked: []
    };
    const report = buildYouTubeChannelCandidateReport({
      items: [
        youtubeItem({ id: "a", channelId: "channel-a", durationSeconds: 1200 }),
        youtubeItem({ id: "b", channelId: "channel-a", durationSeconds: 600 })
      ],
      channelPolicy: policy,
      formatCache: { version: 1, entries: {} },
      now: new Date("2026-07-18T00:00:00.000Z")
    });

    assert.equal(report.totals.channels, 1);
    assert.equal(report.channels[0]?.status, "unlisted");
    assert.equal(report.channels[0]?.atLeastTenMinutes, 2);
    assert.equal(policy.preferred.length, 0);
    assert.equal(policy.blocked.length, 0);
  });
});

describe("YouTube retroactive reclassification", () => {
  it("removes Shorts and blocked channels, keeps unknowns, and applies effective tiers", async () => {
    const policy: YouTubeChannelPolicyFile = {
      version: 1,
      preferred: ["preferred"],
      blocked: ["blocked"]
    };
    const result = await reclassifyExistingYouTubeItems({
      items: [
        youtubeItem({ id: "preferred-regular", channelId: "preferred" }),
        youtubeItem({
          id: "unlisted-unknown",
          channelId: "unlisted",
          durationSeconds: 120
        }),
        youtubeItem({
          id: "explicit-short",
          channelId: "preferred",
          title: "대한축구협회 회장 선거 #shorts",
          durationSeconds: 45
        }),
        youtubeItem({ id: "blocked-video", channelId: "blocked" })
      ],
      issues,
      people: [],
      channelPolicy: policy,
      formatCache: { version: 1, entries: {} },
      shortsFetchImpl: async (input) => {
        const url = new URL(
          typeof input === "string" || input instanceof URL ? input : input.url
        );
        const videoId = url.pathname.split("/").at(-1);
        if (videoId === "unlisted-unknown") {
          throw new Error("network unavailable");
        }
        return new Response(null, {
          status: 303,
          headers: { Location: `https://www.youtube.com/watch?v=${videoId}` }
        });
      },
      now: new Date("2026-07-18T00:00:00.000Z")
    });

    assert.deepEqual(
      new Set(result.items.map((item) => item.id)),
      new Set(["youtube_preferred-regular", "youtube_unlisted-unknown"])
    );
    assert.equal(
      result.items.find((item) => item.id === "youtube_preferred-regular")
        ?.relevanceTier,
      undefined
    );
    assert.equal(
      result.items.find((item) => item.id === "youtube_unlisted-unknown")
        ?.relevanceTier,
      "secondary"
    );
    assert.deepEqual(result.report.removedShorts, ["youtube_explicit-short"]);
    assert.deepEqual(result.report.removedBlocked, ["youtube_blocked-video"]);
    assert.deepEqual(result.report.unknownFormats, ["youtube_unlisted-unknown"]);
  });
});
