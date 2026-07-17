import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Issue, YouTubeSearchQuery } from "../lib/schema";
import {
  collectYouTubeRun,
  getYouTubeBackfillDays,
  getYouTubeCollectionWindow,
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
  liveBroadcastContent = "none"
}: {
  title: string;
  liveBroadcastContent?: "none" | "live" | "upcoming";
}) {
  return {
    publishedAt: "2026-07-16T03:00:00.000Z",
    channelId: "channel-1",
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
  it("keeps regular videos and Shorts while excluding live-origin videos", async () => {
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
      maxPagesPerQuery: 1
    });

    assert.equal(result.attempted, 2);
    assert.equal(result.succeeded, 2);
    assert.equal(result.failed, 0);
    assert.deepEqual(
      new Set(result.items.map((item) => item.id)),
      new Set(["youtube_regular-video", "youtube_short-video"])
    );
    assert.deepEqual(
      result.items.map((item) => item.youtube?.durationSeconds).sort((left, right) => (left ?? 0) - (right ?? 0)),
      [45, 754]
    );
    assert.equal(result.items.every((item) => item.sourceType === "youtube"), true);
    assert.equal(result.items.every((item) => item.issueTags.includes("election")), true);

    const searchUrl = requestedUrls.find((url) => url.pathname.endsWith("/search"));
    assert.ok(searchUrl);
    assert.equal(searchUrl.searchParams.get("q"), queries[0].query);
    assert.equal(searchUrl.searchParams.get("type"), "video");
    assert.equal(searchUrl.searchParams.get("order"), "date");
    assert.equal(searchUrl.searchParams.get("publishedAfter"), "2026-04-18T00:00:00.000Z");
    assert.equal(searchUrl.searchParams.get("publishedBefore"), "2026-07-17T00:00:00.000Z");
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

    assert.deepEqual(result, { items: [], attempted: 1, succeeded: 0, failed: 1 });
    assert.equal(requested, false);
  });
});
