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
