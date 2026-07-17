import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RadarItem } from "../lib/schema";
import {
  buildStoryClusters,
  createStoryFactAnchorModel,
  extractStoryFactAnchors,
  getStoryClusterId,
  isBurstStoryPairMatch,
  isStoryPairMatch
} from "../lib/story-clusters";
import {
  createStorySimilarityModel,
  normalizeStoryText
} from "../lib/story-similarity";

function item(
  id: string,
  override: Partial<RadarItem> = {}
): RadarItem {
  const publishedAt = override.publishedAt ?? "2026-07-16T00:00:00.000Z";
  return {
    id,
    type: "news",
    title: id,
    summary: "같은 사건을 설명하는 기사 요약입니다",
    url: `https://example.com/${id}`,
    originalUrl: `https://example.com/${id}`,
    publisher: `publisher-${id}`,
    publishedAt,
    collectedAt: publishedAt,
    matchedKeywords: [],
    issueTags: ["issue"],
    personTags: [],
    sourceType: "news",
    isOfficial: false,
    relevanceScore: 50,
    ...override
  };
}

describe("story clustering", () => {
  it("normalizes compatibility characters and strips news boilerplate", () => {
    assert.equal(
      normalizeStoryText(" [\uc18d\ubcf4] \uff21\uff22\uff23, \ucd95\uad6c\ud611\ud68c! "),
      "abc\ucd95\uad6c\ud611\ud68c"
    );
    assert.equal(
      normalizeStoryText("\ucd95\uad6c\ud611\ud68c \uc120\uac70\uc81c\ub3c4 \uac1c\ud3b8(\uc885\ud5692\ubcf4)"),
      "\ucd95\uad6c\ud611\ud68c\uc120\uac70\uc81c\ub3c4\uac1c\ud3b8"
    );
    assert.deepEqual(
      [...extractStoryFactAnchors({
        title: "선거인단 41 배 확대",
        summary: "기존 2244명에서 9만 2194명으로 늘었다"
      })],
      ["41배", "2244명", "9만2194명"]
    );
  });

  it("trusts very strong non-opinion titles when snippets quote different passages", () => {
    const matching = [
      item("strong-a", {
        title: "대한체육회장 선거인단 41배 확대…축구협회장 선거제도 개선 발판 마련",
        summary: "이사회 일정과 회장 궐위 규정을 설명하는 첫 번째 문단",
        publisher: "news-a"
      }),
      item("strong-b", {
        title: "대한체육회장 선거인단 41배 확대…축구협회장 선거제도 개선 발판",
        summary: "선수와 지도자에게 투표권을 부여하는 완전히 다른 문단",
        publisher: "news-b",
        publishedAt: "2026-07-16T01:00:00.000Z"
      })
    ];
    const noSharedTag = matching.map((candidate, index) => ({
      ...candidate,
      id: `unshared-${index}`,
      issueTags: [`issue-${index}`]
    }));

    assert.deepEqual(buildStoryClusters(matching).clusters[0]?.memberIds, [
      "strong-a",
      "strong-b"
    ]);
    assert.deepEqual(buildStoryClusters(noSharedTag).clusters, []);
  });

  it("preclusters a rare multi-publisher fact burst despite varied titles and snippets", () => {
    const shared = [
      item("fact-a", {
        title: "대한체육회 선거인단 대폭 확대",
        summary: "선거인단을 41배 늘리는 정관 개정안이 통과됐다",
        publisher: "news-a"
      }),
      item("fact-b", {
        title: "체육회 정관 개정 만장일치 통과",
        summary: "현장 구성원 참여가 늘어 종전보다 41배가 된다",
        publisher: "news-b",
        publishedAt: "2026-07-16T01:00:00.000Z"
      }),
      item("fact-c", {
        title: "축구협회 선거 개편 길 열려",
        summary: "대한체육회 투표권 규모가 41배 확대된 영향이다",
        publisher: "news-c",
        publishedAt: "2026-07-16T02:00:00.000Z"
      }),
      item("fact-d", {
        title: "선수와 지도자도 회장 투표 참여",
        summary: "개정안에 따라 회장 선거인단은 약 41배로 늘어난다",
        publisher: "news-d",
        publishedAt: "2026-07-16T03:00:00.000Z"
      })
    ];
    const unrelated = item("fact-unrelated", {
      title: "시설 예산이 크게 증가",
      summary: "다른 사업의 예산이 41배 늘었다",
      issueTags: ["other-issue"],
      publisher: "news-e",
      publishedAt: "2026-07-16T04:00:00.000Z"
    });
    const items = [...shared, unrelated];
    const factAnchorModel = createStoryFactAnchorModel(items);

    assert.equal(factAnchorModel.qualifyingAnchors.has("41배"), true);
    assert.equal(
      isBurstStoryPairMatch(shared[0], shared[3], factAnchorModel),
      true
    );
    assert.equal(
      isBurstStoryPairMatch(shared[0], unrelated, factAnchorModel),
      false
    );
    assert.deepEqual(buildStoryClusters(items).clusters[0]?.memberIds, [
      "fact-a",
      "fact-b",
      "fact-c",
      "fact-d"
    ]);
  });

  it("does not use recurring durations as burst fact anchors", () => {
    const durations = [
      item("duration-a", {
        title: "대표팀 운영 평가",
        summary: "지난 12년 동안의 경기력을 분석했다",
        publisher: "news-a"
      }),
      item("duration-b", {
        title: "협회 조직 개편 제안",
        summary: "집행부의 12년 운영을 되돌아봤다",
        publisher: "news-b",
        publishedAt: "2026-07-16T01:00:00.000Z"
      }),
      item("duration-c", {
        title: "감독 선임 절차 비판",
        summary: "한국 축구의 12년 과제를 짚었다",
        publisher: "news-c",
        publishedAt: "2026-07-16T02:00:00.000Z"
      })
    ];
    const factAnchorModel = createStoryFactAnchorModel(durations);

    assert.equal(factAnchorModel.qualifyingAnchors.has("12년"), false);
    assert.deepEqual(buildStoryClusters(durations).clusters, []);
  });

  it("groups reviewed postponement and electoral-college story pairs", () => {
    const items = [
      item("postpone-1", {
        title: "\uad6d\ud68c \ubb38\uccb4\uc704, \ucd95\uad6c\ud611\ud68c \uccad\ubb38\ud68c 22\uc77c\uc5d0\uc11c 30\uc77c\ub85c \uc5f0\uae30",
        summary:
          "\uc5ec\uc57c \ud611\uc0c1\uc744 \uc704\ud574 \ub300\ud55c\ucd95\uad6c\ud611\ud68c \uccad\ubb38\ud68c \uc77c\uc815\uc744 \uc624\ub294 30\uc77c\ub85c \uc5f0\uae30\ud588\ub2e4.",
        publisher: "news-a"
      }),
      item("postpone-2", {
        title: "\ubb38\uccb4\uc704, \ucd95\uad6c\ud611\ud68c \uccad\ubb38\ud68c 22\uc77c\u219230\uc77c \uc5f0\uae30",
        summary:
          "\uad6d\ud68c \ubb38\uccb4\uc704\uac00 \uc5ec\uc57c \ud611\uc0c1\uc744 \uace0\ub824\ud574 \ucd95\uad6c\ud611\ud68c \uccad\ubb38\ud68c \uc77c\uc815\uc744 30\uc77c\ub85c \ubbf8\ub904\ub2e4.",
        publisher: "news-b",
        publishedAt: "2026-07-16T01:00:00.000Z"
      }),
      item("electors-1", {
        title: "\ub300\ud55c\uccb4\uc721\ud68c, \ud68c\uc7a5 \uc120\uac70\uc778\ub2e8 41\ubc30 \ud655\ub300\u2026\ucd95\uad6c\ud611\ud68c\ub3c4 \ubc14\ub014\uae4c",
        summary:
          "\ub300\ud55c\uccb4\uc721\ud68c\uac00 \ud68c\uc7a5 \uc120\uac70\uc778\ub2e8\uc744 \uae30\uc874\ubcf4\ub2e4 41\ubc30 \ub298\ub9ac\ub294 \uc815\uad00 \uac1c\uc815\uc548\uc744 \ud1b5\uacfc\uc2dc\ucf30\ub2e4.",
        publisher: "news-c",
        publishedAt: "2026-07-16T02:00:00.000Z"
      }),
      item("electors-2", {
        title: "\ub300\ud55c\uccb4\uc721\ud68c\uc7a5 \uc120\uac70\uc778\ub2e8 41\ubc30 \ud655\ub300\u2026\ucd95\uad6c\ud611\ud68c \uac1c\uc120 \ubc1c\ud310",
        summary:
          "\uc815\uad00 \uac1c\uc815\uc73c\ub85c \ub300\ud55c\uccb4\uc721\ud68c\uc7a5 \uc120\uac70\uc778\ub2e8\uc774 41\ubc30 \ud655\ub300\ub3fc \ucd95\uad6c\ud611\ud68c \uc120\uac70 \uac1c\ud601\uc758 \ubc1c\ud310\uc774 \ub9c8\ub828\ub410\ub2e4.",
        publisher: "news-d",
        publishedAt: "2026-07-16T03:00:00.000Z"
      })
    ];

    assert.deepEqual(
      buildStoryClusters(items).clusters.map((cluster) => cluster.memberIds),
      [
        ["postpone-1", "postpone-2"],
        ["electors-1", "electors-2"]
      ]
    );
  });

  it("does not combine similarly titled columns or distinct follow-up events", () => {
    const columns = [
      item("column-a", {
        title: "[\ub370\uc2a4\ud06c\uce7c\ub7fc] \ud64d\uba85\ubcf4\ub97c \uc704\ud55c \ubcc0\uba85",
        summary: "\uac10\ub3c5\uc758 \uc120\ud0dd\uacfc \uc804\uc220\uc744 \ud3c9\uac00\ud558\ub294 \uce7c\ub7fc",
        publisher: "column-a"
      }),
      item("column-b", {
        title: "[\ubc1c\ud589\uc778 \uce7c\ub7fc] \ud64d\uba85\ubcf4\ub97c \uc704\ud55c \ubcc0\uba85",
        summary: "\uad6d\ud68c \ud589\uc815\uacfc \uc870\uc9c1 \uad6c\uc870\ub97c \ube44\ud310\ud558\ub294 \uae00",
        publisher: "column-b",
        publishedAt: "2026-07-16T01:00:00.000Z"
      }),
      item("request", {
        title: "\uc120\uc218\ub4e4\uc744 \uccad\ubb38\ud68c \ucc38\uace0\uc778\uc73c\ub85c \uc2e0\uccad",
        summary: "\uc758\uc6d0\uc774 \uc99d\uc5b8\uc744 \ub4e3\uae30 \uc704\ud574 \ucc38\uace0\uc778\uc744 \uc694\uccad\ud588\ub2e4",
        publisher: "request"
      }),
      item("absence", {
        title: "\uc120\uc218\ub4e4, \uad6d\ud68c \uccad\ubb38\ud68c \ubd88\ucc38 \ud1b5\ubcf4",
        summary: "\uc18c\uc18d\ud300 \uacbd\uae30 \uc77c\uc815 \ub54c\ubb38\uc5d0 \ucd9c\uc11d\ud558\uae30 \uc5b4\ub835\ub2e4\uace0 \ubc1d\ud614\ub2e4",
        publisher: "absence",
        publishedAt: "2026-07-16T01:00:00.000Z"
      })
    ];

    assert.deepEqual(buildStoryClusters(columns).clusters, []);
  });

  it("uses complete-link matching instead of transitive union merging", () => {
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
    const model = createStorySimilarityModel(chain);

    assert.equal(isStoryPairMatch(chain[0], chain[1], model), true);
    assert.equal(isStoryPairMatch(chain[1], chain[2], model), true);
    assert.equal(isStoryPairMatch(chain[0], chain[2], model), false);
    assert.deepEqual(buildStoryClusters(chain).clusters[0].memberIds, ["a", "b"]);
  });

  it("is deterministic across input order and derives the id from the seed", () => {
    const pair = [
      item("a", { title: "[\uc18d\ubcf4] \ucd95\uad6c\ud611\ud68c \uccad\ubb38\ud68c \uc5f0\uae30", publisher: "same" }),
      item("b", {
        title: "\ucd95\uad6c\ud611\ud68c \uccad\ubb38\ud68c \uc5f0\uae30(\uc885\ud569)",
        publisher: "same",
        summary: "\uc11c\ub85c \ub2e4\ub978 \uc694\uc57d\uc774\uc5b4\ub3c4 \uac19\uc740 \ubc1c\ud589\ucc98\uc758 \ub3d9\uc77c \uc81c\ubaa9",
        publishedAt: "2026-07-16T01:00:00.000Z"
      })
    ];
    const expected = buildStoryClusters(pair);

    assert.deepEqual(buildStoryClusters([...pair].reverse()), expected);
    assert.equal(expected.clusters[0].seedItemId, "a");
    assert.equal(expected.clusters[0].id, "story_6ea4e3f4db3b3b79d44c");
    assert.equal(expected.clusters[0].id, getStoryClusterId("a"));
  });

  it("excludes official items and articles more than 36 hours apart", () => {
    const current = item("current", {
      title: "\uc644\uc804\ud788 \uac19\uc740 \uc81c\ubaa9",
      publisher: "same"
    });
    const old = item("old", {
      title: current.title,
      publisher: current.publisher,
      publishedAt: "2026-07-14T11:59:59.999Z"
    });
    const official = item("official", {
      type: "official",
      sourceType: "official",
      isOfficial: true,
      title: current.title,
      publisher: current.publisher
    });

    assert.deepEqual(buildStoryClusters([current, old, official]).clusters, []);
  });
});
