import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RadarItem, YouTubeMetadata } from "../lib/schema";
import {
  buildStoryClusters,
  createStoryFactAnchorModel,
  extractStoryFactAnchors,
  getStoryClusterId,
  getYouTubeStoryText,
  isBurstStoryPairMatch,
  isStoryPairMatch,
  isYouTubeStoryPairMatch
} from "../lib/story-clusters";
import {
  createStorySimilarityModel,
  createStorySimilarityModels,
  memoizeStorySimilarityModel,
  normalizeStoryText,
  type StorySimilarityModel,
  type StoryTextFields
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

function youtubeItem(
  id: string,
  override: Partial<Omit<RadarItem, "youtube">> & {
    youtube?: Partial<YouTubeMetadata>;
  } = {}
): RadarItem {
  const { youtube, ...rest } = override;
  return {
    ...item(id, rest),
    type: "youtube",
    sourceType: "youtube",
    youtube: {
      videoId: `video-${id}`,
      channelId: `channel-${id}`,
      thumbnail: {
        url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        width: 480,
        height: 360
      },
      durationSeconds: 600,
      ...youtube
    }
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
    assert.equal(
      normalizeStoryText("[오피셜] 축구협회 새 감독 선임"),
      "축구협회새감독선임"
    );
    assert.equal(
      normalizeStoryText("축구협회 새 감독 선임 (현장영상)"),
      "축구협회새감독선임"
    );
    assert.equal(normalizeStoryText("협회 개혁 전문"), "협회개혁전문");
    assert.deepEqual(
      [...extractStoryFactAnchors({
        title: "선거인단 41 배 확대",
        summary: "기존 2244명에서 9만 2194명으로 늘었다"
      })],
      ["41배", "2244명", "9만2194명"]
    );
  });

  it("trusts very strong non-opinion titles even when rule-derived tags disagree", () => {
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
    assert.deepEqual(buildStoryClusters(noSharedTag).clusters[0]?.memberIds, [
      "unshared-0",
      "unshared-1"
    ]);
  });

  it("groups identical wire-copy titles across publishers without shared tags", () => {
    const wirePair = [
      item("wire-a", {
        title: "임오경 의원, 손흥민·황희찬 축구협회 청문회 참고인 신청 철회",
        summary: "여야 협상 경과를 전하는 리드 문단",
        publisher: "news-a",
        issueTags: ["issue-a"]
      }),
      item("wire-b", {
        title: "임오경 의원, 손흥민·황희찬 축구협회 청문회 참고인 신청 철회",
        summary: "선수 소속팀 일정을 인용한 전혀 다른 문단",
        publisher: "news-b",
        issueTags: ["issue-b"],
        publishedAt: "2026-07-16T01:00:00.000Z"
      })
    ];

    assert.deepEqual(buildStoryClusters(wirePair).clusters[0]?.memberIds, [
      "wire-a",
      "wire-b"
    ]);
  });

  it("enforces the ten-character boundary before exact titles reach fallbacks", () => {
    const nineCharacters = [
      item("nine-a", {
        title: "abcdefghi",
        summary: "같은 문장처럼 보이는 요약",
        publisher: "news-a",
        issueTags: ["issue-a"]
      }),
      item("nine-b", {
        title: "abcdefghi",
        summary: "같은 문장처럼 보이는 요약",
        publisher: "news-b",
        issueTags: ["issue-b"],
        publishedAt: "2026-07-16T01:00:00.000Z"
      })
    ];
    const tenCharacters = nineCharacters.map((candidate, index) => ({
      ...candidate,
      id: `ten-${index}`,
      title: "abcdefghij"
    }));

    assert.equal(Array.from(normalizeStoryText(nineCharacters[0].title)).length, 9);
    assert.equal(Array.from(normalizeStoryText(tenCharacters[0].title)).length, 10);
    assert.deepEqual(buildStoryClusters(nineCharacters).clusters, []);
    assert.deepEqual(buildStoryClusters(tenCharacters).clusters[0]?.memberIds, [
      "ten-0",
      "ten-1"
    ]);
  });

  it("keeps short generic exact titles apart across publishers", () => {
    const generic = [
      item("generic-a", {
        title: "축구",
        summary: "대표팀 감독 선임 절차를 설명한다",
        publisher: "news-a"
      }),
      item("generic-b", {
        title: "축구",
        summary: "지역 유소년 대회 결과를 설명한다",
        publisher: "news-b",
        publishedAt: "2026-07-16T01:00:00.000Z"
      })
    ];

    assert.deepEqual(buildStoryClusters(generic).clusters, []);
  });

  it("keeps identical syndicated column titles apart across publishers", () => {
    const columns = [
      item("column-a", {
        title: "[데스크 칼럼] 홍명보를 위한 변명",
        summary: "감독의 선택과 전술을 평가하는 칼럼",
        publisher: "column-a"
      }),
      item("column-b", {
        title: "[데스크 칼럼] 홍명보를 위한 변명",
        summary: "국회 행정과 조직 구조를 비판하는 글",
        publisher: "column-b",
        publishedAt: "2026-07-16T01:00:00.000Z"
      })
    ];

    assert.deepEqual(buildStoryClusters(columns).clusters, []);
  });

  it("applies the opinion guard even when titles and summaries overlap", () => {
    const columns = [
      item("overlap-column-a", {
        title: "[데스크 칼럼] 홍명보를 위한 변명",
        summary: "감독 선임 절차와 축구협회 책임을 함께 평가한다",
        publisher: "column-a"
      }),
      item("overlap-column-b", {
        title: "[발행인 칼럼] 홍명보를 위한 변명",
        summary: "감독 선임 절차와 축구협회 책임을 함께 평가한다",
        publisher: "column-b",
        publishedAt: "2026-07-16T01:00:00.000Z"
      })
    ];
    const model = createStorySimilarityModel(columns);

    assert.equal(model.compare(columns[0], columns[1]).summary, 1);
    assert.equal(isStoryPairMatch(columns[0], columns[1], model), false);
    assert.deepEqual(buildStoryClusters(columns).clusters, []);
  });

  it("keeps recurring news programme episodes out of lexical fallbacks", () => {
    const episodes = [
      item("news9-a", {
        title: "뉴스9 7월 16일 다시보기 1부",
        summary: "오늘의 주요 축구 소식을 전합니다",
        publisher: "same-news"
      }),
      item("news9-b", {
        title: "뉴스9 7월 17일 다시보기 2부",
        summary: "오늘의 주요 축구 소식을 전합니다",
        publisher: "same-news",
        publishedAt: "2026-07-17T01:00:00.000Z"
      })
    ];

    assert.deepEqual(buildStoryClusters(episodes).clusters, []);
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

  it("keeps exact wire-copy atoms intact when a rare-fact burst overlaps one member", () => {
    const exactFirst = item("wire-a", {
      title: "축구협회 선거제도 개편 논의 본격화",
      summary: "대표자 참여 폭이 종전보다 41배 늘어난다",
      publisher: "news-a",
      issueTags: ["wire-issue"]
    });
    const exactSecond = item("wire-b", {
      title: exactFirst.title,
      summary: "같은 제목의 통신사 기사지만 수치가 없는 별도 리드",
      publisher: "news-b",
      issueTags: ["other-issue"],
      publishedAt: "2026-07-16T01:00:00.000Z"
    });
    const burstSecond = item("burst-b", {
      title: "회장 선거인단 확대안 의결",
      summary: "현장 구성원 투표권이 41배 확대될 전망이다",
      publisher: "news-c",
      issueTags: ["wire-issue"],
      publishedAt: "2026-07-16T02:00:00.000Z"
    });
    const burstThird = item("burst-c", {
      title: "선수와 지도자도 선거 참여",
      summary: "정관 개정으로 선거인단 규모가 41배가 된다",
      publisher: "news-d",
      issueTags: ["wire-issue"],
      publishedAt: "2026-07-16T03:00:00.000Z"
    });
    const items = [exactFirst, exactSecond, burstSecond, burstThird];
    const similarityModel = createStorySimilarityModel(items);
    const factAnchorModel = createStoryFactAnchorModel(items);

    assert.equal(isStoryPairMatch(exactFirst, exactSecond, similarityModel), true);
    assert.equal(
      isBurstStoryPairMatch(exactFirst, burstSecond, factAnchorModel),
      true
    );
    assert.equal(
      isBurstStoryPairMatch(exactSecond, burstSecond, factAnchorModel),
      false
    );

    const expected = buildStoryClusters(items);
    assert.deepEqual(
      expected.clusters.map((cluster) => cluster.memberIds),
      [
        ["wire-a", "wire-b"],
        ["burst-b", "burst-c"]
      ]
    );
    for (const reordered of [
      [burstThird, exactSecond, burstSecond, exactFirst],
      [exactSecond, exactFirst, burstThird, burstSecond],
      [...items].reverse()
    ]) {
      assert.deepEqual(buildStoryClusters(reordered), expected);
    }
  });

  it("does not let one exact-title atom reserve itself before a later fact burst", () => {
    const exactFirst = item("claim-wire-a", {
      title: "축구협회 선거인단 확대안 분석 보도",
      summary: "첫 검토안은 31배였고 후속 의결안은 47배로 정리됐다",
      publisher: "news-a",
      issueTags: ["claim-issue"]
    });
    const exactSecond = item("claim-wire-b", {
      title: exactFirst.title,
      summary: "초기 수치 31배와 최종 수치 47배를 함께 전한 통신사 기사",
      publisher: "news-b",
      issueTags: ["claim-issue"],
      publishedAt: "2026-07-16T01:00:00.000Z"
    });
    const firstAnchorDecoy = item("claim-decoy", {
      title: "별도 시설 사업 예산 검토",
      summary: "지역 시설 예산만 31배 늘리는 무관한 계획이다",
      publisher: "news-c",
      issueTags: ["other-issue"],
      publishedAt: "2026-07-16T02:00:00.000Z"
    });
    const laterBurstPeer = item("claim-peer", {
      title: "현장 대표자 투표권 확대 확정",
      summary: "최종 의결로 참여 규모가 47배 확대된다",
      publisher: "news-d",
      issueTags: ["claim-issue"],
      publishedAt: "2026-07-16T03:00:00.000Z"
    });
    const items = [exactFirst, exactSecond, firstAnchorDecoy, laterBurstPeer];
    const factAnchorModel = createStoryFactAnchorModel(items);

    assert.equal(factAnchorModel.qualifyingAnchors.has("31배"), true);
    assert.equal(factAnchorModel.qualifyingAnchors.has("47배"), true);

    const expected = buildStoryClusters(items);
    assert.deepEqual(expected.clusters.map((cluster) => cluster.memberIds), [
      ["claim-wire-a", "claim-wire-b", "claim-peer"]
    ]);
    for (const reordered of [
      [laterBurstPeer, exactSecond, firstAnchorDecoy, exactFirst],
      [firstAnchorDecoy, exactFirst, laterBurstPeer, exactSecond],
      [...items].reverse()
    ]) {
      assert.deepEqual(buildStoryClusters(reordered), expected);
    }
  });

  it("prefers a larger distinct-atom burst over an earlier raw anchor", () => {
    const exactFirst = item("global-wire-a", {
      title: "축구협회 대의원 제도 개편 공동 보도",
      summary: "초안은 61배, 최종안은 73배 확대하는 내용이다",
      publisher: "news-a",
      issueTags: ["global-issue"]
    });
    const exactSecond = item("global-wire-b", {
      title: exactFirst.title,
      summary: "검토 단계 61배와 의결 단계 73배를 함께 설명한다",
      publisher: "news-b",
      issueTags: ["global-issue"],
      publishedAt: "2026-07-16T01:00:00.000Z"
    });
    const smallPeer = item("global-small-peer", {
      title: "선거 참여 폭 초안 공개",
      summary: "초기 검토안에서 참여 폭을 61배 늘리기로 했다",
      publisher: "news-c",
      issueTags: ["global-issue"],
      publishedAt: "2026-07-16T02:00:00.000Z"
    });
    const decoyFirst = item("global-decoy-a", {
      title: "지역 체육관 임대료 조정",
      summary: "별도 산정 결과 임대료가 61배로 표시됐다",
      publisher: "news-d",
      issueTags: ["decoy-a"],
      publishedAt: "2026-07-16T03:00:00.000Z"
    });
    const decoySecond = item("global-decoy-b", {
      title: "훈련 장비 수량 재산정",
      summary: "무관한 장비 집계가 종전의 61배가 됐다",
      publisher: "news-e",
      issueTags: ["decoy-b"],
      publishedAt: "2026-07-16T04:00:00.000Z"
    });
    const largerPeerFirst = item("global-large-a", {
      title: "현장 지도자 투표 참여 확정",
      summary: "최종안에 따라 선거 참여 규모가 73배 확대된다",
      publisher: "news-f",
      issueTags: ["global-issue"],
      publishedAt: "2026-07-16T05:00:00.000Z"
    });
    const largerPeerSecond = item("global-large-b", {
      title: "선수 대표에게도 선거권 부여",
      summary: "의결된 정관은 대표자 수를 73배로 늘린다",
      publisher: "news-g",
      issueTags: ["global-issue"],
      publishedAt: "2026-07-16T06:00:00.000Z"
    });
    const items = [
      exactFirst,
      exactSecond,
      smallPeer,
      decoyFirst,
      decoySecond,
      largerPeerFirst,
      largerPeerSecond
    ];
    const factAnchorModel = createStoryFactAnchorModel(items);

    assert.equal(factAnchorModel.membersByAnchor.get("61배")?.length, 5);
    assert.equal(factAnchorModel.membersByAnchor.get("73배")?.length, 4);

    const expected = buildStoryClusters(items);
    assert.deepEqual(expected.clusters.map((cluster) => cluster.memberIds), [
      ["global-wire-a", "global-wire-b", "global-large-a", "global-large-b"]
    ]);
    for (const reordered of [
      [
        largerPeerSecond,
        decoyFirst,
        exactSecond,
        smallPeer,
        largerPeerFirst,
        exactFirst,
        decoySecond
      ],
      [...items].reverse()
    ]) {
      assert.deepEqual(buildStoryClusters(reordered), expected);
    }
  });

  it("reclusters a complete-link residual after an overlapping burst wins", () => {
    const overlap = item("residual-a", {
      title: "축구협회 두 선거안 표결 결과 종합",
      summary: "첫 안건은 10표, 두 번째 안건은 20표를 얻었다",
      publisher: "news-a",
      issueTags: ["residual-issue"]
    });
    const smallerPeers = [
      item("residual-c", {
        title: "첫 안건 현장 대표 표결",
        summary: "대의원 투표에서 찬성 10표가 집계됐다",
        publisher: "news-c",
        issueTags: ["residual-issue"],
        publishedAt: "2026-07-16T01:00:00.000Z"
      }),
      item("residual-d", {
        title: "선거 규정 초안 의결",
        summary: "규정 초안은 최종 10표를 받아 통과됐다",
        publisher: "news-d",
        issueTags: ["residual-issue"],
        publishedAt: "2026-07-16T02:00:00.000Z"
      }),
      item("residual-e", {
        title: "대의원 첫 표결 결과 공개",
        summary: "현장 집계 결과 첫 안건에 10표가 모였다",
        publisher: "news-e",
        issueTags: ["residual-issue"],
        publishedAt: "2026-07-16T03:00:00.000Z"
      })
    ];
    const winningPeers = [
      item("residual-f", {
        title: "두 번째 선거안 가결",
        summary: "후속 안건은 찬성 20표로 의결됐다",
        publisher: "news-f",
        issueTags: ["residual-issue"],
        publishedAt: "2026-07-16T04:00:00.000Z"
      }),
      item("residual-g", {
        title: "지도자 참여안 표결 완료",
        summary: "지도자 참여안이 대의원 20표를 얻었다",
        publisher: "news-g",
        issueTags: ["residual-issue"],
        publishedAt: "2026-07-16T05:00:00.000Z"
      }),
      item("residual-h", {
        title: "선수 대표 선거권 안건 통과",
        summary: "선수 대표 안건에 찬성 20표가 나왔다",
        publisher: "news-h",
        issueTags: ["residual-issue"],
        publishedAt: "2026-07-16T06:00:00.000Z"
      }),
      item("residual-i", {
        title: "협회 후속 정관안 확정",
        summary: "후속 정관안은 최종 20표로 확정됐다",
        publisher: "news-i",
        issueTags: ["residual-issue"],
        publishedAt: "2026-07-16T07:00:00.000Z"
      })
    ];
    const items = [overlap, ...smallerPeers, ...winningPeers];
    const factAnchorModel = createStoryFactAnchorModel(items);

    assert.equal(factAnchorModel.membersByAnchor.get("10표")?.length, 4);
    assert.equal(factAnchorModel.membersByAnchor.get("20표")?.length, 5);

    const expected = buildStoryClusters(items);
    assert.deepEqual(expected.clusters.map((cluster) => cluster.memberIds), [
      [
        "residual-a",
        "residual-f",
        "residual-g",
        "residual-h",
        "residual-i"
      ],
      ["residual-c", "residual-d", "residual-e"]
    ]);
    for (const reordered of [
      [
        winningPeers[3],
        smallerPeers[1],
        overlap,
        winningPeers[0],
        smallerPeers[2],
        winningPeers[2],
        smallerPeers[0],
        winningPeers[1]
      ],
      [...items].reverse()
    ]) {
      assert.deepEqual(buildStoryClusters(reordered), expected);
    }
  });

  it("rebuilds anchor partitions when a removed blocker exposes a new pair", () => {
    const blocker = item("repartition-a", {
      title: "협회 두 안건 표결 결과 종합",
      summary: "첫 안건은 10표, 후속 안건은 20표를 얻었다",
      publisher: "news-a",
      issueTags: ["edge-ab", "edge-winner"]
    });
    const firstPeer = item("repartition-b", {
      title: "대의원 명부 수정 의결",
      summary: "명부 조정안 집계 결과는 10표였다",
      publisher: "news-b",
      issueTags: ["edge-ab", "edge-bc"],
      publishedAt: "2026-07-16T01:00:00.000Z"
    });
    const strandedPeer = item("repartition-c", {
      title: "권한대행 조항 최종 승인",
      summary: "임시 운영 조항이 찬성 10표를 받았다",
      publisher: "news-c",
      issueTags: ["edge-bc"],
      publishedAt: "2026-07-16T02:00:00.000Z"
    });
    const winningPeerFirst = item("repartition-d", {
      title: "지도자 참여안 가결",
      summary: "후속 참여안은 최종 20표로 통과됐다",
      publisher: "news-d",
      issueTags: ["edge-winner"],
      publishedAt: "2026-07-16T03:00:00.000Z"
    });
    const winningPeerSecond = item("repartition-e", {
      title: "선수 대표 선거권 확정",
      summary: "선수 대표 안건에 찬성 20표가 모였다",
      publisher: "news-e",
      issueTags: ["edge-winner"],
      publishedAt: "2026-07-16T04:00:00.000Z"
    });
    const items = [
      blocker,
      firstPeer,
      strandedPeer,
      winningPeerFirst,
      winningPeerSecond
    ];
    const factAnchorModel = createStoryFactAnchorModel(items);
    const similarityModel = createStorySimilarityModel(items);

    assert.equal(isBurstStoryPairMatch(blocker, firstPeer, factAnchorModel), true);
    assert.equal(
      isBurstStoryPairMatch(blocker, strandedPeer, factAnchorModel),
      false
    );
    assert.equal(
      isBurstStoryPairMatch(firstPeer, strandedPeer, factAnchorModel),
      true
    );
    assert.equal(isStoryPairMatch(firstPeer, strandedPeer, similarityModel), false);

    const expected = buildStoryClusters(items);
    assert.deepEqual(expected.clusters.map((cluster) => cluster.memberIds), [
      ["repartition-a", "repartition-d", "repartition-e"],
      ["repartition-b", "repartition-c"]
    ]);
    for (const reordered of [
      [
        strandedPeer,
        winningPeerSecond,
        firstPeer,
        blocker,
        winningPeerFirst
      ],
      [...items].reverse()
    ]) {
      assert.deepEqual(buildStoryClusters(reordered), expected);
    }
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

  it("keeps exact wire copies together before an earlier fuzzy match", () => {
    const earlier = item("x", {
      title: "abcdefghij",
      summary: "shared event summary",
      publisher: "news-x"
    });
    const exactFirst = item("a", {
      title: "efghijklmn",
      summary: "shared event summary",
      publisher: "news-a",
      publishedAt: "2026-07-16T01:00:00.000Z"
    });
    const exactSecond = item("b", {
      title: "efghijklmn",
      summary: "entirely unrelated summary",
      publisher: "news-b",
      publishedAt: "2026-07-16T02:00:00.000Z"
    });
    const items = [earlier, exactFirst, exactSecond];
    const model = createStorySimilarityModel(items);

    assert.equal(isStoryPairMatch(earlier, exactFirst, model), true);
    assert.equal(isStoryPairMatch(earlier, exactSecond, model), false);
    assert.equal(isStoryPairMatch(exactFirst, exactSecond, model), true);

    const expected = buildStoryClusters(items);
    assert.deepEqual(expected.clusters.map((cluster) => cluster.memberIds), [
      ["a", "b"]
    ]);
    for (const reordered of [
      [exactSecond, earlier, exactFirst],
      [exactFirst, exactSecond, earlier],
      [...items].reverse()
    ]) {
      assert.deepEqual(buildStoryClusters(reordered), expected);
    }
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

  it("totally orders canonically equivalent IDs", () => {
    const pair = [
      item("가", {
        title: "대한축구협회 선거인단 개편 확정",
        publisher: "news-a"
      }),
      item("가", {
        title: "대한축구협회 선거인단 개편 확정",
        publisher: "news-b"
      })
    ];

    const expected = buildStoryClusters(pair);
    assert.deepEqual(buildStoryClusters([...pair].reverse()), expected);
    assert.equal(expected.clusters.length, 1);
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

describe("YouTube story clustering", () => {
  it("groups identical cross-channel titles without shared tags", () => {
    const syndicated = [
      youtubeItem("video-a", {
        title: "\ucd95\uad6c\ud611\ud68c \uccad\ubb38\ud68c \uc5f0\uae30 \uacb0\uc815 \uad00\ub828 \ube0c\ub9ac\ud551",
        summary: "\ubcf8\ubc29\uc1a1 \ub274\uc2a4 \ud074\ub9bd",
        publisher: "\uc9c0\uc5ed\ubc29\uc1a1 A",
        issueTags: []
      }),
      youtubeItem("video-b", {
        title: "\ucd95\uad6c\ud611\ud68c \uccad\ubb38\ud68c \uc5f0\uae30 \uacb0\uc815 \uad00\ub828 \ube0c\ub9ac\ud551",
        summary: "\ub2e4\uc74c\ub0a0 \uc544\uce68 \uc7ac\ubc29\uc601 \ud074\ub9bd",
        publisher: "\uc9c0\uc5ed\ubc29\uc1a1 B",
        issueTags: [],
        publishedAt: "2026-07-16T13:00:00.000Z"
      })
    ];

    assert.deepEqual(buildStoryClusters(syndicated).clusters[0]?.memberIds, [
      "video-a",
      "video-b"
    ]);
  });

  it("keeps exact re-air titles together before an earlier fuzzy video match", () => {
    const earlier = youtubeItem("video-x", {
      title: "abcdefghij",
      summary: "shared event summary",
      publisher: "channel-x"
    });
    const exactFirst = youtubeItem("video-a", {
      title: "efghijklmn",
      summary: "shared event summary",
      publisher: "channel-a",
      publishedAt: "2026-07-16T01:00:00.000Z"
    });
    const exactSecond = youtubeItem("video-b", {
      title: "efghijklmn",
      summary: "entirely unrelated summary",
      publisher: "channel-b",
      publishedAt: "2026-07-16T02:00:00.000Z"
    });
    const items = [earlier, exactFirst, exactSecond];
    const model = createStorySimilarityModel(items.map(getYouTubeStoryText));

    assert.equal(isYouTubeStoryPairMatch(earlier, exactFirst, model), true);
    assert.equal(isYouTubeStoryPairMatch(earlier, exactSecond, model), false);
    assert.equal(isYouTubeStoryPairMatch(exactFirst, exactSecond, model), true);

    const expected = buildStoryClusters(items);
    assert.deepEqual(expected.clusters.map((cluster) => cluster.memberIds), [
      ["video-a", "video-b"]
    ]);
    assert.deepEqual(
      buildStoryClusters([exactSecond, earlier, exactFirst]),
      expected
    );
    assert.deepEqual(buildStoryClusters([...items].reverse()), expected);
  });

  it("rejects short, opinion, and recurring exact video titles", () => {
    const short = [
      youtubeItem("short-a", {
        title: "뉴스9",
        summary: "첫 번째 방송 내용",
        publisher: "채널 A",
        issueTags: []
      }),
      youtubeItem("short-b", {
        title: "뉴스9",
        summary: "두 번째 방송 내용",
        publisher: "채널 B",
        issueTags: [],
        publishedAt: "2026-07-16T01:00:00.000Z"
      })
    ];
    const opinion = short.map((candidate, index) => ({
      ...candidate,
      id: `opinion-video-${index}`,
      title: "[축구 칼럼] 홍명보 전술을 말하다"
    }));
    const recurring = short.map((candidate, index) => ({
      ...candidate,
      id: `recurring-video-${index}`,
      title: "뉴스9 2026년 7월 16일 다시보기 1부"
    }));

    assert.deepEqual(buildStoryClusters(short).clusters, []);
    assert.deepEqual(buildStoryClusters(opinion).clusters, []);
    assert.deepEqual(buildStoryClusters(recurring).clusters, []);
  });

  it("compares tag-carried governance signal when descriptions are bare hashtags", () => {
    const tagged = [
      youtubeItem("tagged-a", {
        title: "\ucd95\uad6c\ud611\ud68c \uccad\ubb38\ud68c \ucd1d\uc815\ub9ac \ub77c\uc774\ube0c",
        summary: "#\uc1fc\uce20\uc544\ub2d8 #\ucd95\uad6c",
        publisher: "\ucc44\ub110 A",
        issueTags: ["hearing"],
        youtube: { tags: ["\ub300\ud55c\ucd95\uad6c\ud611\ud68c", "\uccad\ubb38\ud68c", "\uc815\ubabd\uaddc"] }
      }),
      youtubeItem("tagged-b", {
        title: "\ucd95\uad6c\ud611\ud68c \uccad\ubb38\ud68c \uad00\uc804 \ud3ec\uc778\ud2b8",
        summary: "#\ucd95\uad6c #\uc774\uc288",
        publisher: "\ucc44\ub110 B",
        issueTags: ["hearing"],
        publishedAt: "2026-07-17T00:00:00.000Z",
        youtube: { tags: ["\ub300\ud55c\ucd95\uad6c\ud611\ud68c", "\uccad\ubb38\ud68c", "\uc815\ubabd\uaddc"] }
      })
    ];
    const untagged = tagged.map((candidate) => ({
      ...candidate,
      youtube: { ...candidate.youtube!, tags: undefined }
    }));
    const taggedModel = createStorySimilarityModel(tagged.map(getYouTubeStoryText));
    const untaggedModel = createStorySimilarityModel(untagged.map(getYouTubeStoryText));

    assert.equal(
      getYouTubeStoryText(tagged[0]).summary,
      "#\uc1fc\uce20\uc544\ub2d8 #\ucd95\uad6c \ub300\ud55c\ucd95\uad6c\ud611\ud68c \uccad\ubb38\ud68c \uc815\ubabd\uaddc"
    );
    assert.equal(isYouTubeStoryPairMatch(tagged[0], tagged[1], taggedModel), true);
    assert.equal(
      isYouTubeStoryPairMatch(untagged[0], untagged[1], untaggedModel),
      false
    );
    assert.deepEqual(buildStoryClusters(tagged).clusters[0]?.memberIds, [
      "tagged-a",
      "tagged-b"
    ]);
  });

  it("uses the 72-hour video window instead of the 36-hour news window", () => {
    const first = youtubeItem("window-a", {
      title: "\uc644\uc804\ud788 \uac19\uc740 \uc601\uc0c1 \uc81c\ubaa9\uc758 \uc2ec\uce35 \ud574\uc124",
      publisher: "\ucc44\ub110 A",
      issueTags: []
    });
    const lateFollowUp = youtubeItem("window-b", {
      title: first.title,
      publisher: "\ucc44\ub110 B",
      issueTags: [],
      publishedAt: "2026-07-18T20:00:00.000Z"
    });
    const beyondWindow = youtubeItem("window-c", {
      title: first.title,
      publisher: "\ucc44\ub110 C",
      issueTags: [],
      publishedAt: "2026-07-19T00:00:00.001Z"
    });

    assert.deepEqual(
      buildStoryClusters([first, lateFollowUp]).clusters[0]?.memberIds,
      ["window-a", "window-b"]
    );
    assert.deepEqual(buildStoryClusters([first, beyondWindow]).clusters, []);
  });

  it("never merges news and videos even when titles match exactly", () => {
    const news = item("news", { title: "\ucd95\uad6c\ud611\ud68c \uccad\ubb38\ud68c \uc5f0\uae30 \uacb0\uc815" });
    const video = youtubeItem("video", {
      title: news.title,
      publishedAt: "2026-07-16T01:00:00.000Z"
    });

    assert.deepEqual(buildStoryClusters([news, video]).clusters, []);
  });

  it("keeps news clusters byte-identical when videos are added to the input", () => {
    const newsItems = [
      item("news-a", { title: "\ucd95\uad6c\ud611\ud68c \uccad\ubb38\ud68c \uc5f0\uae30 \ud655\uc815 \ubcf4\ub3c4", publisher: "news-a" }),
      item("news-b", {
        title: "\ucd95\uad6c\ud611\ud68c \uccad\ubb38\ud68c \uc5f0\uae30 \ud655\uc815 \ubcf4\ub3c4",
        publisher: "news-b",
        publishedAt: "2026-07-16T01:00:00.000Z"
      })
    ];
    const videos = [
      youtubeItem("video-a", {
        title: "\uccad\ubb38\ud68c \uc5f0\uae30 \uad00\ub828 \ud574\uc124 \uc601\uc0c1",
        publisher: "\ucc44\ub110 A"
      }),
      youtubeItem("video-b", {
        title: "\uccad\ubb38\ud68c \uc5f0\uae30 \uad00\ub828 \ud574\uc124 \uc601\uc0c1",
        publisher: "\ucc44\ub110 B",
        publishedAt: "2026-07-16T02:00:00.000Z"
      })
    ];
    const newsOnly = buildStoryClusters(newsItems);
    const combined = buildStoryClusters([...newsItems, ...videos]);
    const newsSeedIds = new Set(newsItems.map((candidate) => candidate.id));

    assert.deepEqual(
      combined.clusters.filter((cluster) => newsSeedIds.has(cluster.seedItemId)),
      newsOnly.clusters
    );
    assert.equal(combined.clusters.length, newsOnly.clusters.length + 1);
  });
});

describe("story similarity memoization", () => {
  const corpus: StoryTextFields[] = [
    { title: "축구협회 청문회 연기 결정", summary: "국회 문체위가 청문회 일정을 다시 잡았다" },
    { title: "청문회 연기 결정에 반발", summary: "시민단체가 일정 변경에 반발했다" },
    { title: "대표팀 감독 선임 절차 공개", summary: "전력강화위원회가 선임 절차를 공개했다" }
  ];

  function countingModel(model: StorySimilarityModel): {
    model: StorySimilarityModel;
    calls: () => number;
  } {
    let calls = 0;
    return {
      model: {
        compare(left, right) {
          calls += 1;
          return model.compare(left, right);
        }
      },
      calls: () => calls
    };
  }

  it("scores a reversed pair the same as the original", () => {
    const model = createStorySimilarityModel(corpus);

    for (const left of corpus) {
      for (const right of corpus) {
        assert.deepEqual(
          model.compare(left, right),
          model.compare(right, left),
          `${left.title} vs ${right.title} is not symmetric`
        );
      }
    }
  });

  it("compares a pair of items once and answers both directions with it", () => {
    const counted = countingModel(createStorySimilarityModel(corpus));
    const memoized = memoizeStorySimilarityModel(counted.model);
    const [left, right] = [corpus[0]!, corpus[1]!];
    const expected = createStorySimilarityModel(corpus).compare(left, right);

    assert.deepEqual(memoized.compare(left, right), expected);
    assert.equal(counted.calls(), 1);
    assert.deepEqual(memoized.compare(left, right), expected);
    assert.deepEqual(memoized.compare(right, left), expected);
    assert.equal(counted.calls(), 1);
  });

  it("keeps separate entries for items that only share their text", () => {
    const counted = countingModel(createStorySimilarityModel(corpus));
    const memoized = memoizeStorySimilarityModel(counted.model);
    const [left, right] = [corpus[0]!, corpus[1]!];

    const first = memoized.compare(left, right);
    const copied = memoized.compare({ ...left }, right);

    assert.deepEqual(copied, first);
    assert.equal(counted.calls(), 2);
  });

  it("serves feed models memoized so repeated requests reuse their comparisons", () => {
    const items = corpus.map((fields, index) => ({
      ...fields,
      sourceType: index === 2 ? "youtube" : "news"
    }));
    const models = createStorySimilarityModels(items);

    for (const model of [models.news, models.youtube]) {
      assert.equal(
        model.compare(items[0]!, items[1]!),
        model.compare(items[0]!, items[1]!),
        "a memoized model must hand back the comparison it already made"
      );
    }
  });
});
