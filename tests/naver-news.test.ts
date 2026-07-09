import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ARTICLE_TITLE_RESOLUTION_CONCURRENCY,
  ARTICLE_TITLE_TIMEOUT_MS,
  DEFAULT_NAVER_QUERY_DELAY_MS,
  MAX_ARTICLE_TITLE_RESOLUTIONS,
  NAVER_NEWS_TIMEOUT_MS,
  extractArticleTitle,
  filterNewsItemsForCollection,
  getArticleTitleResolutionConcurrency,
  getArticleTitleTimeoutMs,
  getMaxArticleTitleResolutions,
  getNewsCandidateRelevanceTier,
  getNaverFetchTimeoutMs,
  getNaverQueryDelayMs,
  getNaverSearchQueries,
  pickArticleTitle,
  shouldResolveArticleTitle,
  shouldKeepNewsCandidate
} from "../scripts/collect-naver-news";
import type { Issue, Person, RadarItem } from "../lib/schema";

const baseNewsItem: RadarItem = {
  id: "item_news",
  type: "news",
  title: "테스트 뉴스",
  summary: "짧은 설명",
  url: "https://example.com/news",
  originalUrl: "https://example.com/news",
  publisher: "테스트뉴스",
  publishedAt: "2026-07-08T00:00:00.000Z",
  collectedAt: "2026-07-08T00:10:00.000Z",
  matchedKeywords: ["감사"],
  issueTags: ["mcst-audit"],
  personTags: [],
  sourceType: "news",
  isOfficial: false,
  relevanceScore: 15,
  labels: []
};

describe("shouldKeepNewsCandidate", () => {
  it("rejects generic broad keyword matches without football context", () => {
    assert.equal(
      shouldKeepNewsCandidate({
        classification: {
          issueTags: ["mcst-audit"],
          personTags: [],
          matchedKeywords: ["감사"],
          relevanceScore: 15
        }
      }),
      false
    );

    assert.equal(
      shouldKeepNewsCandidate({
        classification: {
          issueTags: ["kfa-executives"],
          personTags: [],
          matchedKeywords: ["이사회"],
          relevanceScore: 10
        }
      }),
      false
    );
  });

  it("rejects low-score football context matches without person tags", () => {
    assert.equal(
      shouldKeepNewsCandidate({
        classification: {
          issueTags: ["coach-appointment"],
          personTags: [],
          matchedKeywords: ["대표팀 감독"],
          relevanceScore: 10
        }
      }),
      false
    );
  });

  it("keeps organization and person matches in football context", () => {
    assert.equal(
      shouldKeepNewsCandidate({
        classification: {
          issueTags: ["election"],
          personTags: [],
          matchedKeywords: ["축구협회", "회장 선거"],
          relevanceScore: 30
        }
      }),
      true
    );

    assert.equal(
      shouldKeepNewsCandidate({
        title: "정몽규, 대한축구협회장 선거 관련 해명",
        summary: "회장 선거와 선거인단 구성 논란에 대한 입장을 밝혔다.",
        classification: {
          issueTags: ["election"],
          personTags: ["person_chung_mong_gyu"],
          matchedKeywords: ["정몽규", "회장 선거", "해명"],
          relevanceScore: 23
        }
      }),
      true
    );
  });

  it("classifies clear governance matches as primary", () => {
    assert.equal(
      getNewsCandidateRelevanceTier({
        title: "대한축구협회, 대표팀 감독 선임 절차 개선안 논의",
        summary: "전력강화위원회 운영과 감독 선임 절차의 투명성 제고 방안을 검토했다.",
        classification: {
          issueTags: ["coach-appointment"],
          personTags: ["person_hong_myung_bo"],
          matchedKeywords: ["대한축구협회", "대표팀 감독", "전력강화위원회"],
          relevanceScore: 38
        }
      }),
      "primary"
    );
  });

  it("classifies searchable borderline matches as secondary", () => {
    assert.equal(
      getNewsCandidateRelevanceTier({
        title: "대한축구협회 관계자, 대표팀 훈련 현장 점검",
        summary: "선임 절차나 감사 이슈는 아니지만 KFA 동향으로 검색 가치가 있다.",
        classification: {
          issueTags: [],
          personTags: [],
          matchedKeywords: ["대한축구협회", "KFA"],
          relevanceScore: 20
        }
      }),
      "secondary"
    );

    assert.equal(
      shouldKeepNewsCandidate({
        title: "대한축구협회 관계자, 대표팀 훈련 현장 점검",
        summary: "선임 절차나 감사 이슈는 아니지만 KFA 동향으로 검색 가치가 있다.",
        classification: {
          issueTags: [],
          personTags: [],
          matchedKeywords: ["대한축구협회", "KFA"],
          relevanceScore: 20
        }
      }),
      true
    );
  });

  it("rejects local association interview matched by broad audit keywords", () => {
    assert.equal(
      shouldKeepNewsCandidate({
        title: "[99.9MHz] 안광률 경기도의회 민주당 대표의원 인터뷰",
        summary:
          "지방의회가 독립적인 예산 편성권과 감사권을 가져야 한다. 시흥시 축구협회 사무국장을 역임한 그는 정치는 축구와 같은 팀 스포츠라고 정의했다.",
        classification: {
          issueTags: ["mcst-audit"],
          personTags: [],
          matchedKeywords: ["축구협회 감사", "축구협회", "감사"],
          relevanceScore: 25
        }
      }),
      false
    );
  });

  it("rejects broad KFA mentions without tracked issues or people", () => {
    assert.equal(
      shouldKeepNewsCandidate({
        title: "대륜고 축구 부, 지역리그 '전승 우승'",
        summary:
          "대한축구협회 주최 대구/경북 권역 리그에서 대륜고등학교가 리그 최종전에서 승리했다.",
        classification: {
          issueTags: [],
          personTags: [],
          matchedKeywords: ["대한축구협회", "축구협회"],
          relevanceScore: 30
        }
      }),
      false
    );
  });

  it("rejects local competition result stories matched by broad governance keywords", () => {
    assert.equal(
      shouldKeepNewsCandidate({
        title: "달서구청 여성 축구 단 '전국 정상'",
        summary:
          "충청북도 축구협회가 주최하고 충주시 축구협회가 주관한 전국대회에서 여성 축구단이 우승했다. 최우수 지도자 상도 받았다.",
        classification: {
          issueTags: ["youth-governance"],
          personTags: [],
          matchedKeywords: ["지도자", "축구협회", "축구협회 지도자"],
          relevanceScore: 25
        }
      }),
      false
    );
  });

  it("rejects performance blame stories without governance context", () => {
    assert.equal(
      shouldKeepNewsCandidate({
        title: "월드컵 탈락 원흉으로 지목된 레전드들",
        summary:
          "홍명보 전 대한민국 축구 국가대표팀 감독이 2026 북중미월드컵에서 한국의 32강 진출 실패 및 조기탈락의 책임자로 지목되는 가운데 포르투갈의 슈퍼스타도 언급됐다.",
        classification: {
          issueTags: ["coach-appointment"],
          personTags: ["person_hong_myung_bo"],
          matchedKeywords: ["대표팀 감독", "홍명보"],
          relevanceScore: 18
        }
      }),
      false
    );
  });

  it("keeps tracked person mentions when they are tied to governance context", () => {
    assert.equal(
      shouldKeepNewsCandidate({
        title: "홍명보, 국회 청문회 출석 요구에 입장 밝힌다",
        summary: "문체위는 대한축구협회 현안과 대표팀 감독 선임 절차를 질의할 예정이다.",
        classification: {
          issueTags: [],
          personTags: ["person_hong_myung_bo"],
          matchedKeywords: ["홍명보"],
          relevanceScore: 8
        }
      }),
      true
    );

    assert.equal(
      shouldKeepNewsCandidate({
        title: "[단독] “정몽규 밀면, 경기 배정해 줄게”…승급 언급에 노골적 지지",
        summary:
          "다음 날 선거에서 정몽규 후보는 85% 득표율로 4선에 성공했다. 선거 운동 자격 논란도 제기됐다.",
        classification: {
          issueTags: [],
          personTags: ["person_chung_mong_gyu"],
          matchedKeywords: ["정몽규"],
          relevanceScore: 8
        }
      }),
      true
    );

    assert.equal(
      shouldKeepNewsCandidate({
        title: "경찰 \"홍명보 선임 관련 의혹, 수사 지연 사유 있지만 신속 결론\"",
        summary: "이임생 전 기술이사 등 협회 관계자들을 상대로 수사를 이어가고 있다.",
        classification: {
          issueTags: [],
          personTags: ["person_hong_myung_bo", "person_lee_im_saeng"],
          matchedKeywords: ["홍명보", "이임생"],
          relevanceScore: 16
        }
      }),
      true
    );

    assert.equal(
      shouldKeepNewsCandidate({
        title: "전 전력강화위원 \"마치 감독은 한국팀 올 생각했어\"",
        summary:
          "홍명보 전 감독이 외국인 감독들과 최종 후보로 올라갈 때 거수로 결정이 이뤄졌다는 증언이 나왔다.",
        classification: {
          issueTags: [],
          personTags: ["person_hong_myung_bo"],
          matchedKeywords: ["축구협회", "홍명보"],
          relevanceScore: 18
        }
      }),
      true
    );
  });

  it("rejects tracked person mentions used only as sports trivia or political analogy", () => {
    const lowRelatedExamples = [
      {
        title: "메시·손흥민 함께 뛴다…MLS 올스타전 로스터 29인 발표",
        summary:
          "한국 선수가 MLS 올스타전에 나서는 건 2003년 LA 갤럭시에서 뛰었던 홍명보 전 축구 대표팀 감독 이후 손흥민이 두 번째다.",
        classification: {
          issueTags: ["coach-appointment"],
          personTags: ["person_hong_myung_bo"],
          matchedKeywords: ["대표팀 감독", "홍명보"],
          relevanceScore: 18
        }
      },
      {
        title: "'손흥민 병역 혜택' 받았던 AG 와일드카드, 올해엔 이기혁·양현준·엄지성 낙점",
        summary:
          "대한 축구협회는 남자 축구 대표팀 23명의 최종 엔트리를 대한체육회에 제출했다. 홍명보 감독의 부름을 받았던 선수들도 언급됐다.",
        classification: {
          issueTags: [],
          personTags: ["person_hong_myung_bo"],
          matchedKeywords: ["축구협회", "홍명보"],
          relevanceScore: 18
        }
      },
      {
        title: "장성철 \"김어준의 김민석 인터뷰, 정청래와는 손절 의미\"[한판승부]",
        summary:
          "홍명보의 위기처럼 정청래의 위기라는 정치 평론과 당 대표 선거 전망을 다뤘다.",
        classification: {
          issueTags: [],
          personTags: ["person_hong_myung_bo"],
          matchedKeywords: ["홍명보"],
          relevanceScore: 8
        }
      },
      {
        title: "수원의 유망주가 대만 대표 겸 득점왕으로 변신! 강태원의 확 바뀐 축구인생 [뽈터뷰]",
        summary:
          "한국에서 축구를 배운 강태원이 대만 축구협회 전력에 보탬이 됐고 홍명보호 사례도 함께 언급됐다.",
        classification: {
          issueTags: [],
          personTags: ["person_hong_myung_bo"],
          matchedKeywords: ["축구협회", "홍명보"],
          relevanceScore: 18
        }
      },
      {
        title: "[오늘의 주요일정·9일] 윤석열 '체포방해 등' 상고심 선고",
        summary:
          "문화체육관광위원회 전체회의와 대한 축구협회 현안 관련 청문회 등 여러 일정을 나열했다.",
        classification: {
          issueTags: ["youth-governance"],
          personTags: [],
          matchedKeywords: ["축구협회", "지도자"],
          relevanceScore: 20
        }
      },
      {
        title: "송영길 \"홍명보같은 정청래호, 선호투표는 11차 당무위결정\"[한판승부]",
        summary:
          "홍명보 감독을 정치 상황에 빗대며 전당대회 선호투표와 당무위 결정을 설명했다. 인터뷰 말미에는 감사 인사를 전했다.",
        classification: {
          issueTags: [],
          personTags: ["person_hong_myung_bo"],
          matchedKeywords: ["감사", "해명", "홍명보"],
          relevanceScore: 13
        }
      }
    ];

    for (const example of lowRelatedExamples) {
      assert.equal(getNewsCandidateRelevanceTier(example), "reject", example.title);
      assert.equal(shouldKeepNewsCandidate(example), false, example.title);
    }
  });

  it("keeps explicit MCST audit coverage about KFA governance", () => {
    assert.equal(
      shouldKeepNewsCandidate({
        title: "문체부, 대한축구협회 감사 결과 후속 조치 검토",
        summary: "대표팀 감독 선임 절차와 KFA 운영 개선안을 함께 들여다본다.",
        classification: {
          issueTags: ["mcst-audit"],
          personTags: [],
          matchedKeywords: ["문체부 감사", "대한축구협회", "감사"],
          relevanceScore: 35
        }
      }),
      true
    );
  });

  it("keeps youth governance coverage with explicit system reform context", () => {
    assert.equal(
      shouldKeepNewsCandidate({
        title: "대한축구협회, 유소년 지도자 제도 개편안 발표",
        summary: "유소년 육성 시스템과 거버넌스 개선을 위한 후속 조치를 공개했다.",
        classification: {
          issueTags: ["youth-governance"],
          personTags: [],
          matchedKeywords: ["대한축구협회", "지도자", "유소년", "거버넌스"],
          relevanceScore: 40
        }
      }),
      true
    );
  });

  it("keeps coach appointment stories with explicit procedure context", () => {
    assert.equal(
      shouldKeepNewsCandidate({
        title: "대한축구협회, 대표팀 감독 선임 절차 개선안 논의",
        summary: "전력강화위원회 운영과 감독 선임 절차의 투명성 제고 방안을 검토했다.",
        classification: {
          issueTags: ["coach-appointment"],
          personTags: ["person_hong_myung_bo"],
          matchedKeywords: ["대한축구협회", "대표팀 감독", "전력강화위원회"],
          relevanceScore: 38
        }
      }),
      true
    );
  });

  it("rejects foreign football association president matches without Korean football context", () => {
    assert.equal(
      shouldKeepNewsCandidate({
        classification: {
          issueTags: ["election"],
          personTags: [],
          matchedKeywords: ["축구협회", "축구협회장"],
          relevanceScore: 20
        }
      }),
      false
    );
  });

  it("rejects foreign national team coaching articles matched by generic association keywords", () => {
    assert.equal(
      shouldKeepNewsCandidate({
        title:
          "'HERE WE GO'에 '오피셜'만 남았다…클롭, '전차 군단' 독일 대표팀 사령탑 부임 임박",
        summary:
          "글로벌 매체 '디 애슬래틱'은 클롭 감독과 독일 축구협회가 차기 사령탑 자리를 두고 논의한다고 전했다.",
        classification: {
          issueTags: ["youth-governance"],
          personTags: [],
          matchedKeywords: ["축구협회", "지도자"],
          relevanceScore: 20
        }
      }),
      false
    );
  });
});

describe("getNaverQueryDelayMs", () => {
  it("uses a safe default and accepts bounded overrides", () => {
    assert.equal(getNaverQueryDelayMs(undefined), DEFAULT_NAVER_QUERY_DELAY_MS);
    assert.equal(getNaverQueryDelayMs("0"), 0);
    assert.equal(getNaverQueryDelayMs("750"), 750);
    assert.equal(getNaverQueryDelayMs("-1"), DEFAULT_NAVER_QUERY_DELAY_MS);
    assert.equal(getNaverQueryDelayMs("99999"), DEFAULT_NAVER_QUERY_DELAY_MS);
    assert.equal(getNaverQueryDelayMs("abc"), DEFAULT_NAVER_QUERY_DELAY_MS);
  });
});

describe("collector timeout and title resolution settings", () => {
  it("uses bounded defaults for external fetches and title resolution", () => {
    assert.equal(getNaverFetchTimeoutMs(undefined), NAVER_NEWS_TIMEOUT_MS);
    assert.equal(getNaverFetchTimeoutMs("5000"), 5000);
    assert.equal(getNaverFetchTimeoutMs("99999"), NAVER_NEWS_TIMEOUT_MS);

    assert.equal(getArticleTitleTimeoutMs(undefined), ARTICLE_TITLE_TIMEOUT_MS);
    assert.equal(getArticleTitleTimeoutMs("1000"), 1000);
    assert.equal(getArticleTitleTimeoutMs("100"), ARTICLE_TITLE_TIMEOUT_MS);

    assert.equal(getMaxArticleTitleResolutions(undefined), MAX_ARTICLE_TITLE_RESOLUTIONS);
    assert.equal(getMaxArticleTitleResolutions("0"), 0);
    assert.equal(getMaxArticleTitleResolutions("40"), 40);
    assert.equal(getMaxArticleTitleResolutions("99999"), MAX_ARTICLE_TITLE_RESOLUTIONS);

    assert.equal(
      getArticleTitleResolutionConcurrency(undefined),
      ARTICLE_TITLE_RESOLUTION_CONCURRENCY
    );
    assert.equal(getArticleTitleResolutionConcurrency("4"), 4);
    assert.equal(
      getArticleTitleResolutionConcurrency("0"),
      ARTICLE_TITLE_RESOLUTION_CONCURRENCY
    );
  });
});

describe("article title resolution", () => {
  it("resolves only likely truncated API titles", () => {
    assert.equal(shouldResolveArticleTitle("홍명보 감독 선임 논란"), false);
    assert.equal(
      shouldResolveArticleTitle("“나중에 다 밝혀질 것!” 미국으로 떠난 홍명보 감독..."),
      true
    );
    assert.equal(shouldResolveArticleTitle("월드컵 탈락 후폭풍…"), true);
  });

  it("extracts article titles from common metadata fields", () => {
    assert.equal(
      extractArticleTitle(
        '<html><head><meta property="og:title" content="원문 기사 전체 제목"></head></html>'
      ),
      "원문 기사 전체 제목"
    );

    assert.equal(
      extractArticleTitle(
        '<script type="application/ld+json">{"@type":"NewsArticle","headline":"JSON-LD 기사 제목"}</script>'
      ),
      "JSON-LD 기사 제목"
    );
  });

  it("uses a longer source title only when it expands the API prefix", () => {
    const apiTitle = "'국제 망신' 韓 월드컵 망치고 남몰래 도주→역시 '비난 세례' 못 피했다...";
    const fullTitle =
      "'국제 망신' 韓 월드컵 망치고 남몰래 도주→역시 '비난 세례' 못 피했다, 끝내 사과 없이 출국";

    assert.equal(pickArticleTitle(apiTitle, `${fullTitle} | 스타뉴스`), fullTitle);
    assert.equal(pickArticleTitle(apiTitle, "전혀 다른 기사 제목"), apiTitle);
    assert.equal(pickArticleTitle("이미 완성된 기사 제목", fullTitle), "이미 완성된 기사 제목");
  });

  it("keeps inline title text together after source metadata extraction", () => {
    assert.equal(
      pickArticleTitle(
        "대륜고 축구...",
        "<b>대륜고</b> 축구부, 지역리그 전승 우승 | 테스트뉴스"
      ),
      "대륜고 축구부, 지역리그 전승 우승"
    );
  });
});

describe("filterNewsItemsForCollection", () => {
  it("filters low-context news while keeping official items", () => {
    const officialItem: RadarItem = {
      ...baseNewsItem,
      id: "item_official",
      type: "official",
      sourceType: "official",
      isOfficial: true,
      issueTags: [],
      matchedKeywords: []
    };

    const relevantNewsItem: RadarItem = {
      ...baseNewsItem,
      id: "item_relevant",
      matchedKeywords: ["대한축구협회", "회장 선거"],
      relevanceScore: 30
    };

    const filtered = filterNewsItemsForCollection([
      baseNewsItem,
      officialItem,
      relevantNewsItem
    ]);

    assert.deepEqual(
      filtered.map((item) => item.id),
      ["item_official", "item_relevant"]
    );
  });
});

describe("getNaverSearchQueries", () => {
  it("keeps coach appointment and person queries inside the collection query window", () => {
    const issues: Issue[] = [
      {
        id: "coach-appointment",
        name: "감독 선임",
        description: "대표팀 감독 선임 관련 이슈",
        keywords: ["감독 선임", "대표팀 감독", "전력강화위원회", "감독 후보"],
        priority: 7
      }
    ];
    const fillerPeople: Person[] = Array.from({ length: 8 }, (_, index) => ({
      id: `person_filler_${index}`,
      name: `추적인물${index}`,
      aliases: [],
      role: "수집 쿼리 제한 재현용 인물",
      keywords: [`추적인물${index}`],
      priority: index + 4,
      published: true
    }));
    const people: Person[] = [
      {
        id: "person_hong_myung_bo",
        name: "홍명보",
        aliases: ["Hong Myung-bo"],
        role: "대표팀 감독 관련 인물",
        keywords: ["홍명보"],
        priority: 3,
        published: true
      },
      ...fillerPeople,
      {
        id: "person_hyun_young_min",
        name: "현영민",
        aliases: ["Hyun Young-min"],
        role: "전력강화위원장",
        keywords: ["현영민"],
        priority: 12,
        published: true
      },
      {
        id: "person_lee_im_saeng",
        name: "이임생",
        aliases: ["Lee Lim-saeng"],
        role: "전 대한축구협회 기술총괄이사",
        keywords: ["이임생"],
        priority: 13,
        published: true
      }
    ];

    const queries = getNaverSearchQueries({ issues, people });

    assert.ok(queries.includes("전력강화위원회"));
    assert.ok(queries.includes("감독 후보"));
    assert.ok(queries.includes("\"홍명보\" 대한축구협회"));
    assert.ok(queries.includes("\"현영민\" 대한축구협회"));
    assert.ok(queries.includes("\"이임생\" 대한축구협회"));
  });
});
