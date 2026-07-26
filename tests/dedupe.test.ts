import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { canonicalizeUrl, dedupeItems, sortItemsLatestFirst } from "../lib/dedupe";
import type { RadarItem } from "../lib/schema";

const baseItem: RadarItem = {
  id: "item_base",
  type: "news",
  title: "대한축구협회 선거인단 관련 보도",
  summary: "짧은 설명",
  url: "https://example.com/news/1",
  originalUrl: "https://example.com/news/1",
  publisher: "테스트뉴스",
  publishedAt: "2026-07-07T05:00:00.000Z",
  collectedAt: "2026-07-07T05:30:00.000Z",
  matchedKeywords: ["대한축구협회"],
  issueTags: ["electoral-college"],
  personTags: [],
  sourceType: "news",
  isOfficial: false,
  relevanceScore: 50
};

describe("canonicalizeUrl", () => {
  it("normalizes tracking parameters and trailing slash", () => {
    assert.equal(
      canonicalizeUrl("https://example.com/news/1/?utm_source=x&fbclid=y"),
      "https://example.com/news/1"
    );
  });

  it("sorts significant query parameters and strips tracking parameters case-insensitively", () => {
    assert.equal(
      canonicalizeUrl("https://EXAMPLE.com/news/1?b=2&UTM_Source=x&a=1"),
      "https://example.com/news/1?a=1&b=2"
    );
  });

  it("normalizes YouTube watch, short, embed, and share URLs to one video URL", () => {
    const expected = "https://www.youtube.com/watch?v=abc-123";

    assert.equal(canonicalizeUrl("https://youtu.be/abc-123?t=3"), expected);
    assert.equal(canonicalizeUrl("https://m.youtube.com/shorts/abc-123"), expected);
    assert.equal(canonicalizeUrl("https://www.youtube.com/embed/abc-123"), expected);
    assert.equal(
      canonicalizeUrl("https://www.youtube.com/watch?v=abc-123&utm_source=test"),
      expected
    );
  });
});

describe("dedupeItems", () => {
  it("chooses one deterministic representative when identity and timestamps tie", () => {
    const firstPayload = {
      ...baseItem,
      summary: "A 페이로드"
    };
    const secondPayload = {
      ...baseItem,
      summary: "Z 페이로드"
    };

    const forward = dedupeItems([firstPayload, secondPayload]);
    const reverse = dedupeItems([secondPayload, firstPayload]);

    assert.deepEqual(forward, reverse);
    assert.equal(forward.length, 1);
    assert.equal(forward[0].summary, "Z 페이로드");
  });

  it("keeps equal-latest representative metadata identical across collection runs", () => {
    const earlyPayload = {
      ...baseItem,
      summary: "초기 페이로드",
      discoveryQueries: ["초기 질의"]
    };
    const preferredPayload = {
      ...baseItem,
      summary: "Z 대표 페이로드",
      collectedAt: "2026-07-07T06:00:00.000Z",
      discoveryQueries: ["Z 대표 질의"]
    };
    const tiedChallenger = {
      ...baseItem,
      summary: "A 도전 페이로드",
      collectedAt: "2026-07-07T06:00:00.000Z",
      discoveryQueries: ["A 도전 질의"]
    };

    const oneShot = dedupeItems([
      earlyPayload,
      preferredPayload,
      tiedChallenger
    ]);
    const incremental = dedupeItems([
      ...dedupeItems([earlyPayload, preferredPayload]),
      tiedChallenger
    ]);

    assert.deepEqual(incremental, oneShot);
    assert.equal(oneShot.length, 1);
    assert.equal(oneShot[0].summary, "Z 대표 페이로드");
    assert.deepEqual(oneShot[0].discoveryQueries, [
      "초기 질의",
      "A 도전 질의",
      "Z 대표 질의"
    ]);
  });

  it("keeps the representative semantic metadata without promoting stale URL variants", () => {
    const items = dedupeItems([
      {
        ...baseItem,
        title: "오래된 강한 제목",
        summary: "오래된 검색 스니펫",
        matchedKeywords: ["오래된 강한 근거"],
        issueTags: ["stale-issue"],
        personTags: ["stale-person"],
        relevanceScore: 90,
        discoveryQueries: ["오래된 검색"],
        labels: ["오래된 라벨"]
      },
      {
        ...baseItem,
        id: "item_later",
        title: "대표 기사 제목",
        summary: "현재 대표 검색 스니펫",
        url: "https://example.com/news/1?utm_source=naver",
        collectedAt: "2026-07-07T06:00:00.000Z",
        matchedKeywords: ["대표 기사 근거"],
        issueTags: ["current-issue"],
        personTags: [],
        relevanceScore: 30,
        relevanceTier: "secondary",
        discoveryQueries: ["현재 검색"],
        labels: ["현재 라벨"]
      },
      {
        ...baseItem,
        id: "item_middle",
        title: "중간 수집 제목",
        summary: "중간 검색 스니펫",
        collectedAt: "2026-07-07T05:45:00.000Z",
        matchedKeywords: ["후속 수집"],
        issueTags: ["middle-issue"],
        personTags: ["middle-person"],
        relevanceScore: 100,
        discoveryQueries: ["중간 검색"],
        labels: ["중간 라벨"]
      }
    ]);

    assert.equal(items.length, 1);
    assert.equal(items[0].id, "item_later");
    assert.equal(items[0].title, "대표 기사 제목");
    assert.equal(items[0].summary, "현재 대표 검색 스니펫");
    assert.equal(items[0].collectedAt, baseItem.collectedAt);
    assert.deepEqual(items[0].discoveryQueries, [
      "오래된 검색",
      "중간 검색",
      "현재 검색"
    ]);
    assert.deepEqual(
      {
        matchedKeywords: items[0].matchedKeywords,
        issueTags: items[0].issueTags,
        personTags: items[0].personTags,
        labels: items[0].labels,
        relevanceScore: items[0].relevanceScore,
        relevanceTier: items[0].relevanceTier
      },
      {
        matchedKeywords: ["대표 기사 근거"],
        issueTags: ["current-issue"],
        personTags: [],
        labels: ["현재 라벨"],
        relevanceScore: 30,
        relevanceTier: "secondary"
      }
    );
  });

  it("dedupes title, publisher, and publishedAt matches when URLs differ", () => {
    const items = dedupeItems([
      baseItem,
      {
        ...baseItem,
        id: "item_same_story",
        url: "https://m.example.com/news/1",
        originalUrl: "https://m.example.com/news/1",
        collectedAt: "2026-07-07T06:00:00.000Z"
      }
    ]);

    assert.equal(items.length, 1);
    assert.equal(items[0].id, "item_same_story");
    assert.equal(items[0].collectedAt, baseItem.collectedAt);
  });

  it("keeps the earliest publication time when a re-collection stamps a newer one", () => {
    const items = dedupeItems([
      baseItem,
      {
        ...baseItem,
        id: "item_recollected",
        publishedAt: "2026-07-08T09:00:00.000Z",
        collectedAt: "2026-07-08T09:00:00.000Z"
      }
    ]);

    assert.equal(items.length, 1);
    assert.equal(items[0].id, "item_recollected");
    assert.equal(items[0].publishedAt, baseItem.publishedAt);
    assert.equal(items[0].collectedAt, baseItem.collectedAt);
  });

  it("merges a re-upload of the same report published within the window", () => {
    const items = dedupeItems([
      {
        ...baseItem,
        id: "youtube_first",
        type: "youtube",
        sourceType: "youtube",
        title: "경찰, '홍명보 논란' 사실상 재수사?...연일 관계자 소환 / YTN",
        publisher: "YTN",
        url: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
        originalUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
        publishedAt: "2026-07-18T21:31:36.000Z",
        collectedAt: "2026-07-19T03:55:51.000Z",
        youtube: {
          videoId: "aaaaaaaaaaa",
          channelId: "channel-ytn",
          thumbnail: {
            url: "https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg",
            width: 480,
            height: 360
          },
          durationSeconds: 117
        }
      },
      {
        ...baseItem,
        id: "youtube_reupload",
        type: "youtube",
        sourceType: "youtube",
        title: "경찰, '홍명보 논란' 사실상 재수사?...연일 관계자 소환 / YTN",
        publisher: "YTN",
        url: "https://www.youtube.com/watch?v=bbbbbbbbbbb",
        originalUrl: "https://www.youtube.com/watch?v=bbbbbbbbbbb",
        publishedAt: "2026-07-19T13:47:51.000Z",
        collectedAt: "2026-07-19T13:54:36.000Z",
        youtube: {
          videoId: "bbbbbbbbbbb",
          channelId: "channel-ytn",
          thumbnail: {
            url: "https://i.ytimg.com/vi/bbbbbbbbbbb/hqdefault.jpg",
            width: 480,
            height: 360
          },
          durationSeconds: 119
        }
      }
    ]);

    assert.equal(items.length, 1);
    assert.equal(items[0].id, "youtube_reupload");
    assert.equal(items[0].publishedAt, "2026-07-18T21:31:36.000Z");
  });

  it("keeps identical titles apart once they fall outside the window", () => {
    const items = dedupeItems([
      {
        ...baseItem,
        id: "item_episode_1",
        title: "주간 축구협회 브리핑",
        publishedAt: "2026-07-07T05:00:00.000Z",
        url: "https://example.com/show/1",
        originalUrl: "https://example.com/show/1"
      },
      {
        ...baseItem,
        id: "item_episode_2",
        title: "주간 축구협회 브리핑",
        publishedAt: "2026-07-09T05:00:00.000Z",
        url: "https://example.com/show/2",
        originalUrl: "https://example.com/show/2"
      }
    ]);

    assert.deepEqual(
      items.map((item) => item.id),
      ["item_episode_2", "item_episode_1"]
    );
  });

  it("bounds every permutation of a same-title run to one window", () => {
    const run = [
      {
        ...baseItem,
        id: "item_hour_0",
        title: "주간 축구협회 브리핑",
        publishedAt: "2026-07-07T05:00:00.000Z",
        url: "https://example.com/run/1",
        originalUrl: "https://example.com/run/1"
      },
      {
        ...baseItem,
        id: "item_hour_20",
        title: "주간 축구협회 브리핑",
        publishedAt: "2026-07-08T01:00:00.000Z",
        url: "https://example.com/run/2",
        originalUrl: "https://example.com/run/2"
      },
      {
        ...baseItem,
        id: "item_hour_40",
        title: "주간 축구협회 브리핑",
        publishedAt: "2026-07-08T21:00:00.000Z",
        url: "https://example.com/run/3",
        originalUrl: "https://example.com/run/3"
      }
    ];
    const permutations = <T>(values: T[]): T[][] =>
      values.length <= 1
        ? [values]
        : values.flatMap((value, index) =>
            permutations(values.filter((_, otherIndex) => otherIndex !== index)).map(
              (rest) => [value, ...rest]
            )
          );

    const results = permutations(run).map((items) => dedupeItems(items));

    // Each item sits 20h from its neighbour: without an anchor they would chain
    // into a single 40h group. Every input order must instead produce the same
    // two bounded groups and representatives.
    for (const items of results) {
      assert.equal(items.length, 2);
      assert.deepEqual(
        items.map((item) => ({ id: item.id, publishedAt: item.publishedAt })),
        [
          {
            id: "item_hour_40",
            publishedAt: "2026-07-08T21:00:00.000Z"
          },
          {
            id: "item_hour_20",
            publishedAt: "2026-07-07T05:00:00.000Z"
          }
        ]
      );
    }
  });

  it("merges at the 24-hour boundary but not one millisecond beyond it", () => {
    const atBoundary = dedupeItems([
      {
        ...baseItem,
        id: "item_boundary_start",
        title: "24시간 경계 보도",
        publishedAt: "2026-07-07T05:00:00.000Z",
        url: "https://example.com/boundary/start",
        originalUrl: "https://example.com/boundary/start"
      },
      {
        ...baseItem,
        id: "item_boundary_end",
        title: "24시간 경계 보도",
        publishedAt: "2026-07-08T05:00:00.000Z",
        url: "https://example.com/boundary/end",
        originalUrl: "https://example.com/boundary/end"
      }
    ]);
    const beyondBoundary = dedupeItems([
      {
        ...baseItem,
        id: "item_beyond_start",
        title: "24시간 초과 보도",
        publishedAt: "2026-07-07T05:00:00.000Z",
        url: "https://example.com/beyond/start",
        originalUrl: "https://example.com/beyond/start"
      },
      {
        ...baseItem,
        id: "item_beyond_end",
        title: "24시간 초과 보도",
        publishedAt: "2026-07-08T05:00:00.001Z",
        url: "https://example.com/beyond/end",
        originalUrl: "https://example.com/beyond/end"
      }
    ]);

    assert.equal(atBoundary.length, 1);
    assert.equal(beyondBoundary.length, 2);
  });

  it("does not merge news and YouTube records by title, publisher, and time", () => {
    const items = dedupeItems([
      {
        ...baseItem,
        id: "news_cross_type",
        title: "동일한 방송 리포트",
        publisher: "테스트방송",
        url: "https://example.com/news/cross-type",
        originalUrl: "https://example.com/news/cross-type"
      },
      {
        ...baseItem,
        id: "youtube_cross_type",
        type: "youtube",
        sourceType: "youtube",
        title: "동일한 방송 리포트",
        publisher: "테스트방송",
        url: "https://www.youtube.com/watch?v=cross-type1",
        originalUrl: "https://www.youtube.com/watch?v=cross-type1",
        youtube: {
          videoId: "cross-type1",
          channelId: "channel-cross-type",
          thumbnail: {
            url: "https://i.ytimg.com/vi/cross-type1/hqdefault.jpg",
            width: 480,
            height: 360
          },
          durationSeconds: 120
        }
      }
    ]);

    assert.deepEqual(
      items.map((item) => item.id),
      ["news_cross_type", "youtube_cross_type"]
    );
  });

  it("merges the same story from one publisher when only the timestamp shifts", () => {
    const items = dedupeItems([
      {
        ...baseItem,
        id: "item_first_fetch",
        publishedAt: "2026-07-07T05:00:00.000Z",
        url: "https://example.com/news/a",
        originalUrl: "https://example.com/news/a"
      },
      {
        ...baseItem,
        id: "item_updated_fetch",
        publishedAt: "2026-07-07T09:30:00.000Z",
        collectedAt: "2026-07-07T09:40:00.000Z",
        url: "https://example.com/news/b",
        originalUrl: "https://example.com/news/b"
      }
    ]);

    assert.equal(items.length, 1);
    assert.equal(items[0].id, "item_updated_fetch");
    assert.equal(items[0].publishedAt, "2026-07-07T05:00:00.000Z");
  });

  it("collapses a transitive chain of URL aliases into one record", () => {
    const items = dedupeItems([
      {
        ...baseItem,
        title: "첫 번째 제목",
        url: "https://example.com/legacy",
        originalUrl: "https://example.com/a",
        matchedKeywords: ["첫 발견"]
      },
      {
        ...baseItem,
        id: "item_alias_b",
        title: "두 번째 제목",
        url: "https://example.com/a",
        originalUrl: "https://example.com/b",
        collectedAt: "2026-07-07T06:00:00.000Z",
        matchedKeywords: ["두 번째 발견"]
      },
      {
        ...baseItem,
        id: "item_alias_c",
        title: "세 번째 제목",
        url: "https://example.com/b",
        originalUrl: "https://example.com/c",
        collectedAt: "2026-07-07T07:00:00.000Z",
        matchedKeywords: ["세 번째 발견"]
      }
    ]);

    assert.equal(items.length, 1);
    assert.equal(items[0].id, "item_alias_c");
    assert.equal(items[0].collectedAt, baseItem.collectedAt);
    assert.deepEqual(items[0].matchedKeywords, ["세 번째 발견"]);
  });

  it("retains the full near-duplicate span across collection runs", () => {
    const hour0 = {
      ...baseItem,
      id: "item_incremental_0",
      title: "회차 간 중복 범위 보존",
      publishedAt: "2026-07-07T05:00:00.000Z",
      url: "https://example.com/incremental/0",
      originalUrl: "https://example.com/incremental/0"
    };
    const hour20 = {
      ...hour0,
      id: "item_incremental_20",
      publishedAt: "2026-07-08T01:00:00.000Z",
      url: "https://example.com/incremental/20",
      originalUrl: "https://example.com/incremental/20"
    };
    const hour40 = {
      ...hour0,
      id: "item_incremental_40",
      publishedAt: "2026-07-08T21:00:00.000Z",
      url: "https://example.com/incremental/40",
      originalUrl: "https://example.com/incremental/40"
    };

    const firstRun = dedupeItems([hour20, hour40]);
    assert.equal(firstRun.length, 1);
    assert.equal(
      firstRun[0].dedupeState?.latestPublishedAt,
      new Date(hour40.publishedAt).getTime()
    );

    const secondRun = dedupeItems([...firstRun, hour0]);
    assert.equal(secondRun.length, 2);
    assert.deepEqual(
      secondRun.map((item) => item.originalUrl).sort(),
      [hour0.originalUrl, hour40.originalUrl].sort()
    );
  });

  it("retains hard URL aliases across collection runs", () => {
    const firstRun = dedupeItems([
      {
        ...baseItem,
        id: "item_alias_run_a",
        title: "첫 회차 A",
        url: "https://example.com/alias/legacy",
        originalUrl: "https://example.com/alias/a"
      },
      {
        ...baseItem,
        id: "item_alias_run_b",
        title: "첫 회차 B",
        url: "https://example.com/alias/a",
        originalUrl: "https://example.com/alias/b",
        collectedAt: "2026-07-07T06:00:00.000Z"
      }
    ]);
    assert.equal(firstRun.length, 1);
    assert.deepEqual(firstRun[0].dedupeState?.urls, [
      "https://example.com/alias/a",
      "https://example.com/alias/b",
      "https://example.com/alias/legacy"
    ]);

    const secondRun = dedupeItems([
      ...firstRun,
      {
        ...baseItem,
        id: "item_alias_run_c",
        title: "둘째 회차 C",
        url: "https://example.com/alias/legacy",
        originalUrl: "https://example.com/alias/c",
        collectedAt: "2026-07-07T07:00:00.000Z"
      }
    ]);

    assert.equal(secondRun.length, 1);
    assert.equal(secondRun[0].id, "item_alias_run_c");
    assert.equal(secondRun[0].originalUrl, "https://example.com/alias/c");
  });

  it("removes redundant persisted evidence from a reconstructible singleton", () => {
    const nearKey =
      "news|news|대한축구협회 선거인단 관련 보도|테스트뉴스";
    const itemWithRedundantState: RadarItem = {
      ...baseItem,
      dedupeState: {
        version: 1,
        urls: [baseItem.url],
        stories: [`${nearKey}|${baseItem.publishedAt}`],
        nearKeys: [nearKey],
        earliestPublishedAt: new Date(baseItem.publishedAt).getTime(),
        latestPublishedAt: new Date(baseItem.publishedAt).getTime(),
        representativeCollectedAt: new Date(baseItem.collectedAt).getTime(),
        latestCollectedAt: new Date(baseItem.collectedAt).getTime()
      }
    };

    assert.deepEqual(dedupeItems([itemWithRedundantState]), [baseItem]);
  });

  it("does not promote a merge-rewritten story key to hard duplicate evidence", () => {
    const firstObservation = {
      ...baseItem,
      id: "item_authentic_story_a",
      title: "서로 다른 원래 제목 A",
      url: "https://example.com/authentic/a",
      originalUrl: "https://example.com/authentic/shared"
    };
    const laterAlias = {
      ...baseItem,
      id: "item_authentic_story_b",
      title: "서로 다른 원래 제목 B",
      url: "https://example.com/authentic/shared",
      originalUrl: "https://example.com/authentic/b",
      publishedAt: "2026-07-11T09:00:00.000Z",
      collectedAt: "2026-07-11T09:30:00.000Z"
    };
    const unrelatedEarlyStory = {
      ...baseItem,
      id: "item_unrelated_early_story",
      title: laterAlias.title,
      url: "https://example.com/authentic/unrelated",
      originalUrl: "https://example.com/authentic/unrelated",
      collectedAt: "2026-07-07T05:40:00.000Z"
    };

    const oneShot = dedupeItems([
      firstObservation,
      laterAlias,
      unrelatedEarlyStory
    ]);
    const incremental = dedupeItems([
      ...dedupeItems([firstObservation, laterAlias]),
      unrelatedEarlyStory
    ]);

    assert.equal(oneShot.length, 2);
    assert.deepEqual(incremental, oneShot);
    const mergedAliases = oneShot.find(
      (item) => item.id === laterAlias.id
    )?.dedupeState?.stories;
    assert.equal(mergedAliases?.length, 2);
    assert.ok(
      mergedAliases?.every(
        (story) =>
          story.endsWith(firstObservation.publishedAt) ||
          story.endsWith(laterAlias.publishedAt)
      )
    );
  });

  it("persists identical authentic story aliases for every hard-edge insertion order", () => {
    const hardEdges = [
      {
        ...baseItem,
        id: "item_hard_edge_a",
        title: "하드 별칭 A",
        url: "https://example.com/hard-edge/0",
        originalUrl: "https://example.com/hard-edge/1",
        publishedAt: "2026-07-07T05:00:00.000Z",
        collectedAt: "2026-07-07T05:30:00.000Z"
      },
      {
        ...baseItem,
        id: "item_hard_edge_b",
        title: "하드 별칭 B",
        url: "https://example.com/hard-edge/1",
        originalUrl: "https://example.com/hard-edge/2",
        publishedAt: "2026-07-09T05:00:00.000Z",
        collectedAt: "2026-07-09T05:30:00.000Z"
      },
      {
        ...baseItem,
        id: "item_hard_edge_c",
        title: "하드 별칭 C",
        url: "https://example.com/hard-edge/2",
        originalUrl: "https://example.com/hard-edge/3",
        publishedAt: "2026-07-11T05:00:00.000Z",
        collectedAt: "2026-07-11T05:30:00.000Z"
      },
      {
        ...baseItem,
        id: "item_hard_edge_d",
        title: "하드 별칭 D",
        url: "https://example.com/hard-edge/3",
        originalUrl: "https://example.com/hard-edge/4",
        publishedAt: "2026-07-13T05:00:00.000Z",
        collectedAt: "2026-07-13T05:30:00.000Z"
      }
    ];
    const permutations = <T>(values: T[]): T[][] =>
      values.length <= 1
        ? [values]
        : values.flatMap((value, index) =>
            permutations(values.filter((_, otherIndex) => otherIndex !== index)).map(
              (rest) => [value, ...rest]
            )
          );
    const expectedStories = hardEdges
      .map((item) =>
        [
          item.type,
          item.sourceType,
          item.title.toLocaleLowerCase("ko-KR"),
          item.publisher.toLocaleLowerCase("ko-KR"),
          item.publishedAt
        ].join("|")
      )
      .sort((left, right) => left.localeCompare(right, "ko-KR"));

    const outputs = permutations(hardEdges).map((insertionOrder) => {
      let accumulated: RadarItem[] = [];
      for (const edge of insertionOrder) {
        accumulated = dedupeItems([...accumulated, edge]);
      }
      assert.equal(accumulated.length, 1);
      assert.deepEqual(accumulated[0].dedupeState?.stories, expectedStories);
      return accumulated;
    });

    assert.equal(
      new Set(
        outputs.map((items) => JSON.stringify(items[0].dedupeState?.stories))
      ).size,
      1
    );
    for (const output of outputs.slice(1)) {
      assert.deepEqual(output, outputs[0]);
    }
  });

  it("totally orders canonically equivalent aliases across incremental runs", () => {
    const aliases = [
      {
        ...baseItem,
        id: "item_unicode_nfc",
        title: "가",
        url: "https://example.com/unicode/shared",
        originalUrl: "https://example.com/unicode/nfc"
      },
      {
        ...baseItem,
        id: "item_unicode_nfd",
        title: "가",
        url: "https://example.com/unicode/shared",
        originalUrl: "https://example.com/unicode/nfd"
      },
      {
        ...baseItem,
        id: "item_unicode_gak",
        title: "각",
        url: "https://example.com/unicode/shared",
        originalUrl: "https://example.com/unicode/gak"
      }
    ];
    const permutations = <T>(values: T[]): T[][] =>
      values.length <= 1
        ? [values]
        : values.flatMap((value, index) =>
            permutations(values.filter((_, otherIndex) => otherIndex !== index)).map(
              (rest) => [value, ...rest]
            )
          );
    const outputs = permutations(aliases).map((insertionOrder) => {
      let accumulated: RadarItem[] = [];
      for (const alias of insertionOrder) {
        accumulated = dedupeItems([...accumulated, alias]);
      }
      assert.equal(accumulated.length, 1);
      return accumulated;
    });

    assert.equal(new Set(outputs.map((items) => JSON.stringify(items))).size, 1);
  });

  it("ranks official representatives by their own collection time across runs", () => {
    const oldOfficial = {
      ...baseItem,
      id: "item_old_official_rep",
      type: "official" as const,
      sourceType: "official" as const,
      isOfficial: true,
      title: "오래된 공식 대표",
      url: "https://example.com/official-rep/a",
      originalUrl: "https://example.com/official-rep/shared"
    };
    const latestNonOfficial = {
      ...baseItem,
      id: "item_latest_news_observation",
      title: "가장 늦게 수집된 비공식 관측",
      url: "https://example.com/official-rep/shared",
      originalUrl: "https://example.com/official-rep/b",
      collectedAt: "2026-07-11T09:30:00.000Z"
    };
    const newerOfficial = {
      ...oldOfficial,
      id: "item_newer_official_rep",
      title: "더 새로운 공식 대표",
      url: "https://example.com/official-rep/b",
      originalUrl: "https://example.com/official-rep/c",
      collectedAt: "2026-07-09T07:30:00.000Z"
    };

    const oneShot = dedupeItems([
      oldOfficial,
      latestNonOfficial,
      newerOfficial
    ]);
    const incremental = dedupeItems([
      ...dedupeItems([oldOfficial, latestNonOfficial]),
      newerOfficial
    ]);

    assert.deepEqual(incremental, oneShot);
    assert.equal(oneShot.length, 1);
    assert.equal(oneShot[0].id, newerOfficial.id);
    assert.equal(
      oneShot[0].dedupeState?.representativeCollectedAt,
      new Date(newerOfficial.collectedAt).getTime()
    );
    assert.equal(
      oneShot[0].dedupeState?.latestCollectedAt,
      new Date(latestNonOfficial.collectedAt).getTime()
    );
  });

});

describe("sortItemsLatestFirst", () => {
  it("orders by published date descending", () => {
    const items = sortItemsLatestFirst([
      baseItem,
      {
        ...baseItem,
        id: "item_new",
        publishedAt: "2026-07-07T08:00:00.000Z"
      }
    ]);

    assert.deepEqual(
      items.map((item) => item.id),
      ["item_new", "item_base"]
    );
  });
});
