import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  Issue,
  Person,
  RadarItem,
  YouTubeChannelPolicyFile
} from "../lib/schema";
import { backfillYouTubeTags } from "../scripts/backfill-youtube-tags";

const issues: Issue[] = [
  {
    id: "election",
    name: "회장 선거",
    description: "대한축구협회장 선거",
    keywords: ["회장 선거", "축구협회장"],
    priority: 1
  }
];

const people: Person[] = [
  {
    id: "person_chung",
    name: "정몽규",
    aliases: ["Chung Mong-gyu"],
    role: "대한축구협회 관련 인물",
    keywords: ["정몽규", "정 몽규"],
    priority: 1,
    published: true
  }
];

const channelPolicy: YouTubeChannelPolicyFile = {
  version: 1,
  preferred: ["channel-1"],
  blocked: []
};

function youtubeItem({
  videoId,
  title = "대한축구협회 회장 선거 분석",
  tags
}: {
  videoId: string;
  title?: string;
  tags?: string[];
}): RadarItem {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  return {
    id: `youtube_${videoId}`,
    type: "youtube",
    title,
    summary: "#해시태그만 있는 설명",
    url,
    originalUrl: url,
    publisher: "테스트 채널",
    publishedAt: "2026-07-16T03:00:00.000Z",
    collectedAt: "2026-07-16T04:00:00.000Z",
    matchedKeywords: [],
    issueTags: [],
    personTags: [],
    sourceType: "youtube",
    isOfficial: false,
    relevanceScore: 0,
    youtube: {
      videoId,
      channelId: "channel-1",
      ...(tags ? { tags } : {}),
      thumbnail: {
        url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        width: 480,
        height: 360
      },
      durationSeconds: 324
    }
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("YouTube tag backfill", () => {
  it("stores fetched tags and reclassifies the item with them", async () => {
    const requestedUrls: URL[] = [];
    const result = await backfillYouTubeTags({
      items: [youtubeItem({ videoId: "video-1", title: "축구 이야기" })],
      issues,
      people,
      channelPolicy,
      apiKey: "test-key",
      now: new Date("2026-07-20T00:00:00.000Z"),
      fetchImpl: async (input) => {
        requestedUrls.push(
          new URL(typeof input === "string" || input instanceof URL ? input : input.url)
        );
        return jsonResponse({
          items: [
            {
              id: "video-1",
              snippet: { tags: ["대한축구협회", "회장 선거", "정몽규"] }
            }
          ]
        });
      }
    });

    assert.equal(result.items.length, 1);
    const [item] = result.items;
    assert.deepEqual(item.youtube?.tags, ["대한축구협회", "회장 선거", "정몽규"]);
    assert.ok(item.issueTags.includes("election"));
    assert.deepEqual(item.personTags, ["person_chung"]);
    // The description the publisher wrote is left untouched.
    assert.equal(item.summary, "#해시태그만 있는 설명");
    assert.equal(result.report.itemsTagged, 1);
    assert.equal(result.report.videosResolved, 1);

    const [url] = requestedUrls;
    assert.equal(url.pathname.endsWith("/videos"), true);
    assert.equal(url.searchParams.get("part"), "snippet");
    assert.equal(url.searchParams.get("id"), "video-1");
  });

  it("skips items that already carry tags unless every video is requested", async () => {
    const requestedIds: string[] = [];
    const items = [
      youtubeItem({ videoId: "video-tagged", tags: ["기존 태그"] }),
      youtubeItem({ videoId: "video-untagged" })
    ];
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      const url = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url
      );
      requestedIds.push(url.searchParams.get("id") ?? "");
      return jsonResponse({ items: [] });
    };

    await backfillYouTubeTags({
      items,
      issues,
      people,
      channelPolicy,
      apiKey: "test-key",
      fetchImpl
    });
    assert.deepEqual(requestedIds, ["video-untagged"]);

    await backfillYouTubeTags({
      items,
      issues,
      people,
      channelPolicy,
      apiKey: "test-key",
      onlyMissing: false,
      fetchImpl
    });
    assert.deepEqual(requestedIds.at(-1), "video-tagged,video-untagged");
  });

  it("reports videos that no longer resolve and leaves those items untouched", async () => {
    const result = await backfillYouTubeTags({
      items: [youtubeItem({ videoId: "video-deleted" })],
      issues,
      people,
      channelPolicy,
      apiKey: "test-key",
      fetchImpl: async () => jsonResponse({ items: [] })
    });

    assert.deepEqual(result.report.videosMissing, ["video-deleted"]);
    assert.equal(result.report.itemsTagged, 0);
    assert.equal(result.items[0].youtube?.tags, undefined);
  });

  it("counts a video that genuinely has no tags without rewriting the item", async () => {
    const result = await backfillYouTubeTags({
      items: [youtubeItem({ videoId: "video-bare" })],
      issues,
      people,
      channelPolicy,
      apiKey: "test-key",
      fetchImpl: async () =>
        jsonResponse({ items: [{ id: "video-bare", snippet: {} }] })
    });

    assert.equal(result.report.itemsWithoutTags, 1);
    assert.equal(result.report.videosMissing.length, 0);
    assert.equal(result.items[0].youtube?.tags, undefined);
  });

  it("reports an item that its own tags disqualify instead of dropping it silently", async () => {
    const result = await backfillYouTubeTags({
      items: [youtubeItem({ videoId: "video-foreign", title: "오늘의 하이라이트" })],
      issues,
      people,
      channelPolicy,
      apiKey: "test-key",
      fetchImpl: async () =>
        jsonResponse({
          items: [
            {
              id: "video-foreign",
              snippet: {
                tags: ["프리미어리그", "맨체스터 유나이티드", "라리가"]
              }
            }
          ]
        })
    });

    // Backfilled tags add signal in both directions: they can also reveal an
    // item as off-topic, so the report has to name it before an apply run.
    assert.deepEqual(result.report.itemsRemoved, ["youtube_video-foreign"]);
    assert.equal(result.report.itemsTagged, 1);
    assert.equal(result.items.length, 0);
  });

  it("refuses to write a partial result when every API call fails", async () => {
    await assert.rejects(
      backfillYouTubeTags({
        items: [youtubeItem({ videoId: "video-1" })],
        issues,
        people,
        channelPolicy,
        apiKey: "test-key",
        fetchImpl: async () => jsonResponse({ error: "quota" }, 403)
      }),
      /did not complete any API call/
    );
  });

  it("requires an API key", async () => {
    await assert.rejects(
      backfillYouTubeTags({
        items: [youtubeItem({ videoId: "video-1" })],
        issues,
        people,
        channelPolicy,
        apiKey: "",
        fetchImpl: async () => jsonResponse({ items: [] })
      }),
      /YOUTUBE_API_KEY is required/
    );
  });

  it("leaves non-YouTube items alone", async () => {
    const newsItem: RadarItem = {
      id: "item_news",
      type: "news",
      title: "대한축구협회 회장 선거 보도",
      summary: "요약",
      url: "https://example.com/news/1",
      originalUrl: "https://example.com/news/1",
      publisher: "테스트뉴스",
      publishedAt: "2026-07-16T03:00:00.000Z",
      collectedAt: "2026-07-16T04:00:00.000Z",
      matchedKeywords: ["대한축구협회"],
      issueTags: ["election"],
      personTags: [],
      sourceType: "news",
      isOfficial: false,
      relevanceScore: 50
    };
    const result = await backfillYouTubeTags({
      items: [newsItem],
      issues,
      people,
      channelPolicy,
      apiKey: "test-key",
      fetchImpl: async () => {
        throw new Error("must not call the API without YouTube items");
      }
    });

    assert.equal(result.report.attempted, 0);
    assert.deepEqual(result.items, [newsItem]);
  });
});
