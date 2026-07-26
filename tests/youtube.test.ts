import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type {
  Issue,
  Person,
  RadarItem,
  YouTubeChannelPolicyFile,
  YouTubeSearchQuery
} from "../lib/schema";
import {
  collectYouTubeRun,
  getYouTubeBackfillDays,
  getYouTubeCollectionWindow,
  getYouTubeMaxPagesPerChannel,
  getYouTubeMaxPagesPerQuery,
  parseYouTubeDuration,
  reclassifyAndFilterYouTubeItemsForCollection
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
const fullIssues = JSON.parse(
  readFileSync(new URL("../data/issues.json", import.meta.url), "utf8")
) as Issue[];
const fullPeople = JSON.parse(
  readFileSync(new URL("../data/people.json", import.meta.url), "utf8")
) as Person[];

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

  it("uses exact KFA tags to anchor otherwise unscored visible governance", async () => {
    const channelPolicy: YouTubeChannelPolicyFile = {
      version: 1,
      preferred: ["channel-1"],
      blocked: []
    };
    // Broadcasters routinely put the exact organization and issue in tags while
    // the title only supplies the broader governance frame.
    const taggedSnippet = {
      ...snippet({ title: "대한민국 축구 운영 책임을 짚는다" }),
      description: "#한국축구 #타임머신",
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
    assert.equal(item.youtube?.contentRelevanceTier, "secondary");
    assert.equal(item.relevanceTier, "secondary");
    // The stored summary stays the publisher's description; tags ride alongside
    // so a later reclassification pass scores the same text.
    assert.equal(item.summary, "#한국축구 #타임머신");
    assert.deepEqual(item.youtube?.tags, ["한국축구", "대한축구협회", "회장 선거"]);
  });

  it("does not let channel-wide SEO tags rescue unrelated visible content", () => {
    const item: RadarItem = {
      id: "youtube_generic-review",
      type: "youtube",
      title: "수원 경기력은 좋은데 골이 안 난다 | 18라운드 리뷰",
      summary: "#한국축구",
      url: "https://www.youtube.com/watch?v=generic-review",
      originalUrl: "https://www.youtube.com/watch?v=generic-review",
      publisher: "축구 분석 채널",
      publishedAt: "2026-07-16T03:00:00.000Z",
      collectedAt: "2026-07-17T00:00:00.000Z",
      matchedKeywords: [],
      issueTags: [],
      personTags: [],
      sourceType: "youtube",
      isOfficial: false,
      relevanceScore: 0,
      youtube: {
        videoId: "generic-review",
        channelId: "channel-1",
        tags: ["한국축구", "대한축구협회", "회장 선거"],
        thumbnail: {
          url: "https://i.ytimg.com/vi/generic-review/hqdefault.jpg",
          width: 480,
          height: 360
        },
        durationSeconds: 600
      }
    };

    const personOnlyItems = [
      {
        ...item,
        id: "youtube_person-highlight",
        title: "홍명보호 월드컵 경기 하이라이트",
        summary: "대표팀 승리 장면을 다시 봅니다.",
        url: "https://www.youtube.com/watch?v=person-highlight",
        originalUrl: "https://www.youtube.com/watch?v=person-highlight",
        youtube: {
          ...item.youtube!,
          videoId: "person-highlight"
        }
      },
      {
        ...item,
        id: "youtube_person-event",
        title: "박지성, 맨유 레전드 행사 참석",
        summary: "팬들과 만난 현장을 전합니다.",
        url: "https://www.youtube.com/watch?v=person-event",
        originalUrl: "https://www.youtube.com/watch?v=person-event",
        youtube: {
          ...item.youtube!,
          videoId: "person-event"
        }
      },
      {
        ...item,
        id: "youtube_performance-highlight",
        title: "대한민국 축구가 망한 이유, 월드컵 참패 하이라이트",
        summary: "대표팀 경기 장면과 골 모음입니다.",
        url: "https://www.youtube.com/watch?v=performance-highlight",
        originalUrl: "https://www.youtube.com/watch?v=performance-highlight",
        youtube: {
          ...item.youtube!,
          videoId: "performance-highlight"
        }
      },
      {
        ...item,
        id: "youtube-gratitude",
        title: "한국축구 감사 이야기",
        summary: "시청해 주셔서 감사합니다.",
        url: "https://www.youtube.com/watch?v=gratitude",
        originalUrl: "https://www.youtube.com/watch?v=gratitude",
        youtube: {
          ...item.youtube!,
          videoId: "gratitude"
        }
      },
      {
        ...item,
        id: "youtube-performance-responsibility",
        title: "한국축구 패배 책임, 공격수 결정력 분석",
        summary: "월드컵 경기 장면과 득점 기회를 리뷰합니다.",
        url: "https://www.youtube.com/watch?v=performance-responsibility",
        originalUrl: "https://www.youtube.com/watch?v=performance-responsibility",
        youtube: {
          ...item.youtube!,
          videoId: "performance-responsibility"
        }
      },
      {
        ...item,
        id: "youtube_local-association",
        title: "강남구축구협회 회장 선거 후보 토론",
        summary: "지역 대의원 대상 토론회입니다.",
        url: "https://www.youtube.com/watch?v=local-association",
        originalUrl: "https://www.youtube.com/watch?v=local-association",
        youtube: {
          ...item.youtube!,
          videoId: "local-association"
        }
      }
    ];
    const trackedPeople: Person[] = [
      {
        id: "person_hong",
        name: "홍명보",
        aliases: [],
        role: "전 국가대표팀 감독",
        keywords: ["홍명보"],
        priority: 1,
        published: true
      },
      {
        id: "person_park",
        name: "박지성",
        aliases: [],
        role: "K-축구혁신위원장",
        keywords: ["박지성"],
        priority: 2,
        published: true
      }
    ];

    assert.deepEqual(
      reclassifyAndFilterYouTubeItemsForCollection({
        items: [item, ...personOnlyItems],
        issues,
        people: trackedPeople,
        channelPolicy: {
          version: 1,
          preferred: ["channel-1"],
          blocked: []
        }
      }),
      []
    );
  });

  it("keeps specific accountability text without letting tags replace its semantics", () => {
    const item: RadarItem = {
      id: "youtube_association-accountability",
      type: "youtube",
      title: "축구협회 패라니까 손흥민 부른 국회의원",
      summary: "오늘 국회 발언을 짚어봅니다.",
      url: "https://www.youtube.com/watch?v=association-accountability",
      originalUrl: "https://www.youtube.com/watch?v=association-accountability",
      publisher: "시사 채널",
      publishedAt: "2026-07-16T03:00:00.000Z",
      collectedAt: "2026-07-17T00:00:00.000Z",
      matchedKeywords: [],
      issueTags: [],
      personTags: [],
      sourceType: "youtube",
      isOfficial: false,
      relevanceScore: 0,
      youtube: {
        videoId: "association-accountability",
        channelId: "channel-1",
        tags: ["대한축구협회", "회장 선거"],
        thumbnail: {
          url: "https://i.ytimg.com/vi/association-accountability/hqdefault.jpg",
          width: 480,
          height: 360
        },
        durationSeconds: 600
      }
    };

    const [reclassified] = reclassifyAndFilterYouTubeItemsForCollection({
      items: [item],
      issues,
      people: [],
      channelPolicy: {
        version: 1,
        preferred: ["channel-1"],
        blocked: []
      }
    });

    assert.equal(reclassified?.id, item.id);
    assert.equal(reclassified?.issueTags.includes("election"), false);
    assert.equal(reclassified?.youtube?.contentRelevanceTier, "primary");
  });

  it("keeps multilingual KFA discipline and corruption evidence as secondary", () => {
    const base: RadarItem = {
      id: "youtube_multilingual-id",
      type: "youtube",
      title:
        "Shin Tae-yong Buka Suara Soal Sanksi Larangan 10 Tahun dari KFA",
      summary:
        "Asosiasi Sepak Bola Korea Selatan (KFA) menjatuhkan sanksi disiplin.",
      url: "https://www.youtube.com/watch?v=multilingual-id",
      originalUrl: "https://www.youtube.com/watch?v=multilingual-id",
      publisher: "국제 뉴스 채널",
      publishedAt: "2026-07-16T03:00:00.000Z",
      collectedAt: "2026-07-17T00:00:00.000Z",
      matchedKeywords: [],
      issueTags: [],
      personTags: [],
      sourceType: "youtube",
      isOfficial: false,
      relevanceScore: 0,
      youtube: {
        videoId: "multilingual-id",
        channelId: "channel-1",
        thumbnail: {
          url: "https://i.ytimg.com/vi/multilingual-id/hqdefault.jpg",
          width: 480,
          height: 360
        },
        durationSeconds: 600
      }
    };
    const german: RadarItem = {
      ...base,
      id: "youtube_multilingual-de",
      title:
        "Korruption und Skandale im koreanischen Fußball (KFA)",
      summary:
        "Der koreanische Fußballverband steckt in einem Korruptionsskandal.",
      url: "https://www.youtube.com/watch?v=multilingual-de",
      originalUrl: "https://www.youtube.com/watch?v=multilingual-de",
      youtube: {
        ...base.youtube!,
        videoId: "multilingual-de"
      }
    };
    const sty: RadarItem = {
      ...base,
      id: "youtube_multilingual-sty",
      title:
        "GEGER! STY DIKENAKAN SANKSI BERAT OLEH KFA, BAGAIMANA NASIB PERSIJA?",
      summary: "",
      url: "https://www.youtube.com/watch?v=multilingual-sty",
      originalUrl: "https://www.youtube.com/watch?v=multilingual-sty",
      youtube: {
        ...base.youtube!,
        videoId: "multilingual-sty"
      }
    };
    const english: RadarItem = {
      ...base,
      id: "youtube_multilingual-en",
      title: "Corruption scandal at the Korean Football Association (KFA)",
      summary: "The investigation examines football governance.",
      url: "https://www.youtube.com/watch?v=multilingual-en",
      originalUrl: "https://www.youtube.com/watch?v=multilingual-en",
      youtube: {
        ...base.youtube!,
        videoId: "multilingual-en"
      }
    };
    const crossSentenceFalsePositive: RadarItem = {
      ...base,
      id: "youtube_multilingual-cross-sentence",
      title: "Shin Tae-yong match highlights",
      summary: "A fan was banned from chat. KFA football clips.",
      url: "https://www.youtube.com/watch?v=multilingual-cross-sentence",
      originalUrl:
        "https://www.youtube.com/watch?v=multilingual-cross-sentence",
      youtube: {
        ...base.youtube!,
        videoId: "multilingual-cross-sentence"
      }
    };
    const pipeSeparatedFalsePositive: RadarItem = {
      ...base,
      id: "youtube_multilingual-pipe",
      title: "STY membahas Persija | KFA menjatuhkan sanksi disiplin",
      summary: "",
      url: "https://www.youtube.com/watch?v=multilingual-pipe",
      originalUrl: "https://www.youtube.com/watch?v=multilingual-pipe",
      youtube: {
        ...base.youtube!,
        videoId: "multilingual-pipe"
      }
    };
    const enDashSeparatedFalsePositive: RadarItem = {
      ...base,
      id: "youtube_multilingual-en-dash",
      title: "STY bersama Persija – KFA memberi sanksi disiplin",
      summary: "",
      url: "https://www.youtube.com/watch?v=multilingual-en-dash",
      originalUrl: "https://www.youtube.com/watch?v=multilingual-en-dash",
      youtube: {
        ...base.youtube!,
        videoId: "multilingual-en-dash"
      }
    };
    const emDashSeparatedFalsePositive: RadarItem = {
      ...base,
      id: "youtube_multilingual-em-dash",
      title: "STY bersama Persija — KFA memberi sanksi disiplin",
      summary: "",
      url: "https://www.youtube.com/watch?v=multilingual-em-dash",
      originalUrl: "https://www.youtube.com/watch?v=multilingual-em-dash",
      youtube: {
        ...base.youtube!,
        videoId: "multilingual-em-dash"
      }
    };
    const asciiDashSeparatedFalsePositive: RadarItem = {
      ...base,
      id: "youtube_multilingual-ascii-dash",
      title: "STY membahas Persija - KFA memberi sanksi disiplin",
      summary: "",
      url: "https://www.youtube.com/watch?v=multilingual-ascii-dash",
      originalUrl:
        "https://www.youtube.com/watch?v=multilingual-ascii-dash",
      youtube: {
        ...base.youtube!,
        videoId: "multilingual-ascii-dash"
      }
    };
    const slashSeparatedFalsePositive: RadarItem = {
      ...base,
      id: "youtube_multilingual-slash",
      title: "STY membahas Persija / KFA memberi sanksi disiplin",
      summary: "",
      url: "https://www.youtube.com/watch?v=multilingual-slash",
      originalUrl: "https://www.youtube.com/watch?v=multilingual-slash",
      youtube: {
        ...base.youtube!,
        videoId: "multilingual-slash"
      }
    };
    const tightSlashSeparatedFalsePositive: RadarItem = {
      ...base,
      id: "youtube_multilingual-tight-slash",
      title: "STY membahas Persija/KFA memberi sanksi disiplin",
      summary: "",
      url: "https://www.youtube.com/watch?v=multilingual-tight-slash",
      originalUrl:
        "https://www.youtube.com/watch?v=multilingual-tight-slash",
      youtube: {
        ...base.youtube!,
        videoId: "multilingual-tight-slash"
      }
    };
    const fullWidthSlashSeparatedFalsePositive: RadarItem = {
      ...base,
      id: "youtube_multilingual-full-width-slash",
      title: "STY membahas Persija／KFA memberi sanksi disiplin",
      summary: "",
      url:
        "https://www.youtube.com/watch?v=multilingual-full-width-slash",
      originalUrl:
        "https://www.youtube.com/watch?v=multilingual-full-width-slash",
      youtube: {
        ...base.youtube!,
        videoId: "multilingual-full-width-slash"
      }
    };
    const tightEnDashSeparatedFalsePositive: RadarItem = {
      ...base,
      id: "youtube_multilingual-tight-en-dash",
      title: "STY membahas Persija–KFA memberi sanksi disiplin",
      summary: "",
      url: "https://www.youtube.com/watch?v=multilingual-tight-en-dash",
      originalUrl:
        "https://www.youtube.com/watch?v=multilingual-tight-en-dash",
      youtube: {
        ...base.youtube!,
        videoId: "multilingual-tight-en-dash"
      }
    };
    const tightEmDashSeparatedFalsePositive: RadarItem = {
      ...base,
      id: "youtube_multilingual-tight-em-dash",
      title: "STY membahas Persija—KFA memberi sanksi disiplin",
      summary: "",
      url: "https://www.youtube.com/watch?v=multilingual-tight-em-dash",
      originalUrl:
        "https://www.youtube.com/watch?v=multilingual-tight-em-dash",
      youtube: {
        ...base.youtube!,
        videoId: "multilingual-tight-em-dash"
      }
    };
    const intraWordHyphenControl: RadarItem = {
      ...base,
      id: "youtube_multilingual-intra-word-hyphen",
      title: "Shin Tae-yong dikenakan sanksi KFA untuk kasus Persija",
      summary: "",
      url:
        "https://www.youtube.com/watch?v=multilingual-intra-word-hyphen",
      originalUrl:
        "https://www.youtube.com/watch?v=multilingual-intra-word-hyphen",
      youtube: {
        ...base.youtube!,
        videoId: "multilingual-intra-word-hyphen"
      }
    };
    const additionalSeparatorFalsePositives: RadarItem[] = [
      ["spaced-double-slash", "STY membahas Persija // KFA memberi sanksi"],
      ["tight-double-slash", "STY membahas Persija//KFA memberi sanksi"],
      ["triple-slash", "STY membahas Persija /// KFA memberi sanksi"],
      ["triple-full-width-slash", "STY membahas Persija／／／KFA memberi sanksi"],
      ["spaced-double-dash", "STY membahas Persija -- KFA memberi sanksi"],
      ["tight-double-dash", "STY membahas Persija--KFA memberi sanksi"],
      ["figure-dash", "STY membahas Persija‒KFA memberi sanksi"],
      ["horizontal-bar", "STY membahas Persija―KFA memberi sanksi"]
    ].map(([suffix, title]) => ({
      ...base,
      id: `youtube_multilingual-${suffix}`,
      title,
      summary: "",
      url: `https://www.youtube.com/watch?v=multilingual-${suffix}`,
      originalUrl: `https://www.youtube.com/watch?v=multilingual-${suffix}`,
      youtube: {
        ...base.youtube!,
        videoId: `multilingual-${suffix}`
      }
    }));
    const httpsUrlControl: RadarItem = {
      ...base,
      id: "youtube_multilingual-https-control",
      title:
        "Shin Tae-yong https://x dikenakan sanksi KFA untuk kasus Persija",
      summary: "",
      url: "https://www.youtube.com/watch?v=multilingual-https-control",
      originalUrl:
        "https://www.youtube.com/watch?v=multilingual-https-control",
      youtube: {
        ...base.youtube!,
        videoId: "multilingual-https-control"
      }
    };

    const kept = reclassifyAndFilterYouTubeItemsForCollection({
      items: [
        base,
        german,
        sty,
        english,
        crossSentenceFalsePositive,
        pipeSeparatedFalsePositive,
        enDashSeparatedFalsePositive,
        emDashSeparatedFalsePositive,
        asciiDashSeparatedFalsePositive,
        slashSeparatedFalsePositive,
        tightSlashSeparatedFalsePositive,
        fullWidthSlashSeparatedFalsePositive,
        tightEnDashSeparatedFalsePositive,
        tightEmDashSeparatedFalsePositive,
        intraWordHyphenControl,
        ...additionalSeparatorFalsePositives,
        httpsUrlControl
      ],
      issues,
      people: [],
      channelPolicy: {
        version: 1,
        preferred: ["channel-1"],
        blocked: []
      }
    });

    assert.deepEqual(
      kept.map((entry) => entry.id),
      [
        base.id,
        german.id,
        sty.id,
        english.id,
        intraWordHyphenControl.id,
        httpsUrlControl.id
      ]
    );
    assert.ok(
      kept.every(
        (entry) =>
          entry.relevanceTier === "secondary" &&
          entry.youtube?.contentRelevanceTier === "secondary" &&
          entry.relevanceScore > 0
      )
    );
  });

  it("keeps reviewed visible KFA process and structural-governance videos", () => {
    const fixtures = [
      {
        id: "reviewed-coach-process",
        title:
          "파울루 벤투 에콰도르행…KFA 사실무근 후 달라진 7일, 감독 선임 전말",
        summary:
          "대한축구협회의 차기 감독 선임을 분석한다. 에콰도르 축구협회도 벤투와 접촉했다."
      },
      {
        id: "reviewed-local-national-bridge",
        title:
          "전북축협회장 발언 논란, 대한민국 축구 개혁이 필요한 이유",
        summary:
          "박지성 혁신위원회와 정몽규 체제의 한국 축구 개혁을 다룬다."
      },
      {
        id: "reviewed-kfa-nepotism",
        title: "손흥민 부진…KFA 인맥 축구가 망친 진짜 이유",
        summary: "KFA의 인맥 중심 운영이 한국 축구에 끼친 영향을 분석한다."
      },
      {
        id: "reviewed-cartel-comparison",
        title: "일본과 비교되는 축구계 카르텔, 빙산의 일각",
        summary:
          "한국 축구 카르텔과 운영 구조를 짚는다. 일본의 축구협회 운영과 비교한다."
      },
      {
        id: "reviewed-corruption-interview",
        title: "홍명보·정몽규 떠난 한국축구…혁신 성공하려면?",
        summary:
          "국회의원과 축구협회 비리제보센터, 대한축구협회 개혁을 논의한다."
      },
      {
        id: "reviewed-hong-process",
        title: "맨유박사 홍명보 감독 선임과정부터 자진사퇴까지의 정리",
        summary: "정몽규와 대한축구협회의 선임 절차를 분석한다."
      }
    ];
    const items: RadarItem[] = fixtures.map((fixture) => ({
      id: `youtube_${fixture.id}`,
      type: "youtube",
      title: fixture.title,
      summary: fixture.summary,
      url: `https://www.youtube.com/watch?v=${fixture.id}`,
      originalUrl: `https://www.youtube.com/watch?v=${fixture.id}`,
      publisher: "검토 채널",
      publishedAt: "2026-07-16T03:00:00.000Z",
      collectedAt: "2026-07-17T00:00:00.000Z",
      matchedKeywords: [],
      issueTags: [],
      personTags: [],
      sourceType: "youtube",
      isOfficial: false,
      relevanceScore: 0,
      youtube: {
        videoId: fixture.id,
        channelId: "reviewed-channel",
        thumbnail: {
          url: `https://i.ytimg.com/vi/${fixture.id}/hqdefault.jpg`,
          width: 480,
          height: 360
        },
        durationSeconds: 600
      }
    }));

    const kept = reclassifyAndFilterYouTubeItemsForCollection({
      items,
      issues: fullIssues,
      people: fullPeople,
      channelPolicy: {
        version: 1,
        preferred: [],
        blocked: []
      }
    });

    assert.deepEqual(
      kept.map((item) => item.id),
      items.map((item) => item.id)
    );
  });

  it("does not let tags upgrade already relevant visible text", () => {
    const visibleIssues: Issue[] = [
      ...issues,
      {
        id: "youth-policy",
        name: "유소년 정책",
        description: "한국 축구 유소년 정책",
        keywords: ["유소년 정책"],
        priority: 2
      }
    ];
    const item: RadarItem = {
      id: "youtube-visible-secondary",
      type: "youtube",
      title: "한국축구 유소년 정책",
      summary: "관련 내용을 설명합니다.",
      url: "https://www.youtube.com/watch?v=visible-secondary",
      originalUrl: "https://www.youtube.com/watch?v=visible-secondary",
      publisher: "축구 분석 채널",
      publishedAt: "2026-07-16T03:00:00.000Z",
      collectedAt: "2026-07-17T00:00:00.000Z",
      matchedKeywords: [],
      issueTags: [],
      personTags: [],
      sourceType: "youtube",
      isOfficial: false,
      relevanceScore: 0,
      youtube: {
        videoId: "visible-secondary",
        channelId: "channel-1",
        tags: ["대한축구협회", "회장 선거"],
        thumbnail: {
          url: "https://i.ytimg.com/vi/visible-secondary/hqdefault.jpg",
          width: 480,
          height: 360
        },
        durationSeconds: 600
      }
    };

    const [reclassified] = reclassifyAndFilterYouTubeItemsForCollection({
      items: [item],
      issues: visibleIssues,
      people: [],
      channelPolicy: {
        version: 1,
        preferred: ["channel-1"],
        blocked: []
      }
    });

    assert.equal(reclassified?.relevanceTier, "secondary");
    assert.equal(reclassified?.issueTags.includes("youth-policy"), true);
    assert.equal(reclassified?.issueTags.includes("election"), false);
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
