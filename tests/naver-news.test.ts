import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_NAVER_QUERY_DELAY_MS,
  filterNewsItemsForCollection,
  getNaverQueryDelayMs,
  getNaverSearchQueries,
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
  labels: ["자동 수집"]
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
        classification: {
          issueTags: [],
          personTags: ["person_chung_mong_gyu"],
          matchedKeywords: ["정몽규"],
          relevanceScore: 8
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
