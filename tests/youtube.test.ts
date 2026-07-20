import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  Issue,
  YouTubeChannelPolicyFile,
  YouTubeSearchQuery
} from "../lib/schema";
import {
  collectYouTubeRun,
  getYouTubeBackfillDays,
  getYouTubeCollectionWindow,
  getYouTubeMaxPagesPerChannel,
  getYouTubeMaxPagesPerQuery,
  parseYouTubeDuration
} from "../scripts/collect-youtube";

const issues: Issue[] = [
  {
    id: "election",
    name: "회장 선거",
    description: "대한축구협회장 선거",
    keywords: ["회장 선거", "축구협회장"],
    priority: 1
  }
];

const queries: YouTubeSearchQuery[] = [
  {
    id: "election",
    query: '"대한축구협회"|"회장 선거"',
    enabled: true
  }
];

function snippet({
  title,
  channelId = "channel-1",
  liveBroadcastContent = "none"
}: {
  title: string;
  channelId?: string;
  liveBroadcastContent?: "none" | "live" | "upcoming";
}) {
  return {
    publishedAt: "2026-07-16T03:00:00.000Z",
    channelId,
    title,
    description: "대한축구협회 회장 선거 절차를 설명합니다.",
    thumbnails: {
      high: {
        url: "https://i.ytimg.com/vi/video/hqdefault.jpg",
        width: 480,
        height: 360
      }
    },
    channelTitle: "축구 분석 채널",
    liveBroadcastContent
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function shortsHtml(videoId: string): string {
  const shortsUrl = `https://www.youtube.com/shorts/${videoId}`;
  return `<link rel="canonical" href="${shortsUrl}"><meta property="og:url" content="${shortsUrl}">`;
}

describe("YouTube collection window", () => {
  it("uses a 90-day window for the first run and a 24-hour overlap later", () => {
    const now = new Date("2026-07-17T00:00:00.000Z");

    assert.deepEqual(getYouTubeCollectionWindow({ now, backfillDays: 90 }), {
      publishedAfter: "2026-04-18T00:00:00.000Z",
      publishedBefore: "2026-07-17T00:00:00.000Z"
    });
    assert.deepEqual(
      getYouTubeCollectionWindow({
        now,
        lastCollectedAt: "2026-07-16T12:00:00.000Z"
      }),
      {
        publishedAfter: "2026-07-15T12:00:00.000Z",
        publishedBefore: "2026-07-17T00:00:00.000Z"
      }
    );
  });

  it("accepts explicit backfill bounds and rejects an inverted interval", () => {
    assert.deepEqual(
      getYouTubeCollectionWindow({
        now: new Date("2026-07-17T00:00:00.000Z"),
        explicitAfter: "2026-05-01",
        explicitBefore: "2026-06-01"
      }),
      {
        publishedAfter: "2026-05-01T00:00:00.000Z",
        publishedBefore: "2026-06-01T00:00:00.000Z"
      }
    );
    assert.throws(
      () =>
        getYouTubeCollectionWindow({
          explicitAfter: "2026-06-01",
          explicitBefore: "2026-05-01"
        }),
      /start must be earlier/
    );
  });

  it("keeps quota-related settings bounded", () => {
    assert.equal(getYouTubeBackfillDays(undefined), 90);
    assert.equal(getYouTubeBackfillDays("30"), 30);
    assert.equal(getYouTubeBackfillDays("0"), 90);
    assert.equal(getYouTubeMaxPagesPerQuery(undefined), 2);
    assert.equal(getYouTubeMaxPagesPerQuery("5"), 5);
    assert.equal(getYouTubeMaxPagesPerQuery("6"), 2);
    assert.equal(getYouTubeMaxPagesPerChannel(undefined), 5);
    assert.equal(getYouTubeMaxPagesPerChannel("20"), 20);
    assert.equal(getYouTubeMaxPagesPerChannel("21"), 5);
  });
});

describe("YouTube duration parsing", () => {
  it("converts ISO-8601 durations to seconds", () => {
    assert.equal(parseYouTubeDuration("PT59S"), 59);
    assert.equal(parseYouTubeDuration("PT1M15S"), 75);
    assert.equal(parseYouTubeDuration("PT2H3M4S"), 7384);
    assert.equal(parseYouTubeDuration("invalid"), 0);
  });
});

describe("YouTube collector", () => {
  it("excludes confirmed Shorts and live-origin videos while keeping regular videos", async () => {
    const requestedUrls: URL[] = [];
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      requestedUrls.push(url);

      if (url.pathname.endsWith("/search")) {
        return jsonResponse({
          items: [
            { id: { videoId: "short-video" }, snippet: snippet({ title: "대한축구협회 회장 선거 Shorts" }) },
            { id: { videoId: "regular-video" }, snippet: snippet({ title: "대한축구협회 회장 선거 분석" }) },
            { id: { videoId: "live-now" }, snippet: snippet({ title: "대한축구협회 생중계", liveBroadcastContent: "live" }) },
            { id: { videoId: "past-live" }, snippet: snippet({ title: "대한축구협회 회장 선거 다시보기" }) }
          ]
        });
      }

      assert.equal(url.pathname.endsWith("/videos"), true);
      return jsonResponse({
        items: [
          {
            id: "short-video",
            snippet: snippet({ title: "대한축구협회 회장 선거 Shorts" }),
            contentDetails: { duration: "PT45S" },
            status: { uploadStatus: "processed", privacyStatus: "public" }
          },
          {
            id: "regular-video",
            snippet: snippet({ title: "대한축구협회 회장 선거 분석" }),
            contentDetails: { duration: "PT12M34S" },
            status: { uploadStatus: "processed", privacyStatus: "public" }
          },
          {
            id: "past-live",
            snippet: snippet({ title: "대한축구협회 회장 선거 다시보기" }),
            contentDetails: { duration: "PT1H2M" },
            status: { uploadStatus: "processed", privacyStatus: "public" },
            liveStreamingDetails: { actualStartTime: "2026-07-16T01:00:00.000Z" }
          }
        ]
      });
    };

    const result = await collectYouTubeRun({
      issues,
      people: [],
      queries,
      now: new Date("2026-07-17T00:00:00.000Z"),
      apiKey: "test-key",
      fetchImpl,
      shortsFetchImpl: async (input) => {
        const url = new URL(
          typeof input === "string" || input instanceof URL ? input : input.url
        );
        const videoId = url.pathname.split("/").at(-1);
        return videoId === "short-video"
          ? new Response(shortsHtml("short-video"), { status: 200 })
          : new Response(null, {
              status: 303,
              headers: {
                Location: `https://www.youtube.com/watch?v=${videoId}`
              }
            });
      },
      maxPagesPerQuery: 1
    });

    assert.equal(result.attempted, 2);
    assert.equal(result.succeeded, 2);
    assert.equal(result.failed, 0);
    assert.deepEqual(
      new Set(result.items.map((item) => item.id)),
      new Set(["youtube_regular-video"])
    );
    assert.deepEqual(
      result.items.map((item) => item.youtube?.durationSeconds).sort((left, right) => (left ?? 0) - (right ?? 0)),
      [754]
    );
    assert.equal(result.items.every((item) => item.sourceType === "youtube"), true);
    assert.equal(result.items.every((item) => item.issueTags.includes("election")), true);
    assert.equal(result.items.every((item) => item.relevanceTier === "secondary"), true);
    assert.equal(result.shortsExcluded, 1);
    assert.equal(result.unknownFormats, 0);
    assert.equal(result.formatCache.entries["short-video"]?.classification, "shorts");
    assert.equal(result.formatCache.entries["regular-video"]?.classification, "regular");

    const searchUrl = requestedUrls.find((url) => url.pathname.endsWith("/search"));
    assert.ok(searchUrl);
    assert.equal(searchUrl.searchParams.get("q"), queries[0].query);
    assert.equal(searchUrl.searchParams.get("type"), "video");
    assert.equal(searchUrl.searchParams.get("order"), "date");
    assert.equal(searchUrl.searchParams.get("publishedAfter"), "2026-04-18T00:00:00.000Z");
    assert.equal(searchUrl.searchParams.get("publishedBefore"), "2026-07-17T00:00:00.000Z");
  });

  it("collects preferred-channel uploads independently and merges them with discovery search", async () => {
    const requestedUrls: URL[] = [];
    const channelPolicy: YouTubeChannelPolicyFile = {
      version: 1,
      preferred: ["channel-1"],
      blocked: []
    };
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      const url = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url
      );
      requestedUrls.push(url);

      if (url.pathname.endsWith("/channels")) {
        return jsonResponse({
          items: [
            {
              id: "channel-1",
              contentDetails: { relatedPlaylists: { uploads: "uploads-1" } }
            }
          ]
        });
      }
      if (url.pathname.endsWith("/playlistItems")) {
        return jsonResponse({
          items: [
            {
              contentDetails: {
                videoId: "channel-upload",
                videoPublishedAt: "2026-07-16T04:00:00.000Z"
              },
              status: { privacyStatus: "public" }
            }
          ]
        });
      }
      if (url.pathname.endsWith("/search")) {
        return jsonResponse({
          items: [
            {
              id: { videoId: "channel-upload" },
              snippet: snippet({ title: "대한축구협회 회장 선거 분석" })
            },
            {
              id: { videoId: "search-video" },
              snippet: snippet({
                title: "대한축구협회 회장 선거 분석",
                channelId: "channel-2"
              })
            }
          ]
        });
      }

      assert.equal(url.pathname.endsWith("/videos"), true);
      return jsonResponse({
        items: ["channel-upload", "search-video"].map((id) => ({
          id,
          snippet: snippet({
            title: `대한축구협회 회장 선거 분석 ${id}`,
            channelId: id === "channel-upload" ? "channel-1" : "channel-2"
          }),
          contentDetails: { duration: "PT12M34S" },
          status: { uploadStatus: "processed", privacyStatus: "public" }
        }))
      });
    };

    const result = await collectYouTubeRun({
      issues,
      people: [],
      queries,
      channelPolicy,
      now: new Date("2026-07-17T00:00:00.000Z"),
      apiKey: "test-key",
      fetchImpl,
      shortsFetchImpl: async (input) => {
        const url = new URL(
          typeof input === "string" || input instanceof URL ? input : input.url
        );
        const videoId = url.pathname.split("/").at(-1);
        return new Response(null, {
          status: 303,
          headers: { Location: `https://www.youtube.com/watch?v=${videoId}` }
        });
      },
      maxPagesPerChannel: 1,
      maxPagesPerQuery: 1
    });

    assert.equal(result.attempted, 4);
    assert.equal(result.succeeded, 4);
    assert.deepEqual(
      new Set(result.items.map((item) => item.id)),
      new Set(["youtube_channel-upload", "youtube_search-video"])
    );
    const preferredItem = result.items.find(
      (item) => item.id === "youtube_channel-upload"
    );
    const unlistedItem = result.items.find(
      (item) => item.id === "youtube_search-video"
    );
    assert.equal(preferredItem?.youtube?.channelStatus, "preferred");
    assert.equal(preferredItem?.youtube?.contentRelevanceTier, "primary");
    assert.equal(preferredItem?.relevanceTier, undefined);
    assert.deepEqual(
      preferredItem?.discoveryQueries,
      ['"대한축구협회"|"회장 선거"', "channel:channel-1"]
    );
    assert.equal(unlistedItem?.youtube?.channelStatus, "unlisted");
    assert.equal(unlistedItem?.youtube?.contentRelevanceTier, "primary");
    assert.equal(unlistedItem?.relevanceTier, "secondary");
    assert.equal(
      requestedUrls.some((url) => url.pathname.endsWith("/playlistItems")),
      true
    );
  });

  it("keeps a preferred-channel video whose only governance signal is in its tags", async () => {
    const channelPolicy: YouTubeChannelPolicyFile = {
      version: 1,
      preferred: ["channel-1"],
      blocked: []
    };
    // Broadcasters routinely upload with a bare hashtag description and list the
    // actual subjects as tags, so tags have to reach the classifier.
    const taggedSnippet = {
      ...snippet({ title: "구자철이 말하는 대한민국 축구가 망한 이유" }),
      description: "#구자철 #타임머신",
      tags: ["한국축구", "대한축구협회", "회장 선거"]
    };
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      const url = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url
      );
      if (url.pathname.endsWith("/channels")) {
        return jsonResponse({
          items: [
            {
              id: "channel-1",
              contentDetails: { relatedPlaylists: { uploads: "uploads-1" } }
            }
          ]
        });
      }
      if (url.pathname.endsWith("/playlistItems")) {
        return jsonResponse({
          items: [
            {
              contentDetails: {
                videoId: "tagged-video",
                videoPublishedAt: "2026-07-16T03:00:00.000Z"
              },
              status: { privacyStatus: "public" }
            }
          ]
        });
      }
      if (url.pathname.endsWith("/search")) {
        return jsonResponse({ items: [] });
      }
      return jsonResponse({
        items: [
          {
            id: "tagged-video",
            snippet: taggedSnippet,
            contentDetails: { duration: "PT5M24S" },
            status: { uploadStatus: "processed", privacyStatus: "public" }
          }
        ]
      });
    };

    const result = await collectYouTubeRun({
      issues,
      people: [],
      queries,
      channelPolicy,
      now: new Date("2026-07-17T00:00:00.000Z"),
      apiKey: "test-key",
      fetchImpl,
      redirectProbeEnabled: false,
      maxPagesPerQuery: 1,
      maxPagesPerChannel: 1
    });

    assert.deepEqual(
      result.items.map((item) => item.id),
      ["youtube_tagged-video"]
    );
    const [item] = result.items;
    assert.ok(item.issueTags.includes("election"));
    // The stored summary stays the publisher's description; tags ride alongside
    // so a later reclassification pass scores the same text.
    assert.equal(item.summary, "#구자철 #타임머신");
    assert.deepEqual(item.youtube?.tags, ["한국축구", "대한축구협회", "회장 선거"]);
  });

  it("fails open when the Shorts redirect probe is unavailable", async () => {
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      const url = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url
      );
      if (url.pathname.endsWith("/search")) {
        return jsonResponse({
          items: [
            {
              id: { videoId: "ambiguous-video" },
              snippet: snippet({ title: "대한축구협회 회장 선거 영상" })
            }
          ]
        });
      }
      return jsonResponse({
        items: [
          {
            id: "ambiguous-video",
            snippet: snippet({ title: "대한축구협회 회장 선거 영상" }),
            contentDetails: { duration: "PT2M" },
            status: { uploadStatus: "processed", privacyStatus: "public" }
          }
        ]
      });
    };

    const result = await collectYouTubeRun({
      issues,
      people: [],
      queries,
      now: new Date("2026-07-17T00:00:00.000Z"),
      apiKey: "test-key",
      fetchImpl,
      shortsFetchImpl: async () => {
        throw new Error("blocked");
      },
      maxPagesPerQuery: 1
    });

    assert.deepEqual(result.items.map((item) => item.id), ["youtube_ambiguous-video"]);
    assert.equal(result.unknownFormats, 1);
    assert.equal(result.shortsExcluded, 0);
  });

  it("returns a failed run without making requests when the API key is missing", async () => {
    let requested = false;
    const result = await collectYouTubeRun({
      issues,
      people: [],
      queries,
      apiKey: "",
      fetchImpl: async () => {
        requested = true;
        return jsonResponse({});
      }
    });

    assert.deepEqual(result, {
      items: [],
      attempted: 1,
      succeeded: 0,
      failed: 1,
      formatCache: { version: 1, entries: {} },
      shortsExcluded: 0,
      unknownFormats: 0,
      redirectProbeHealthy: true
    });
    assert.equal(requested, false);
  });
});
