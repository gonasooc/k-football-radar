import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { classifyItemText, getSearchQueries } from "../lib/classify";
import type { Issue, Person } from "../lib/schema";

const issues: Issue[] = [
  {
    id: "election",
    name: "회장 선거",
    description: "대한축구협회장 선거와 후보, 선거 일정 관련 이슈",
    keywords: ["회장 선거", "축구협회장", "선거인단"],
    priority: 1
  },
  {
    id: "audit",
    name: "문체부 감사",
    description: "문화체육관광부 감사와 후속 조치 관련 이슈",
    keywords: ["문체부 감사", "감사", "재심의"],
    priority: 2
  },
  {
    id: "kfa-executives",
    name: "KFA 임원 동향",
    description: "대한축구협회 임원, 이사회, 집행부 동향",
    keywords: ["임원", "이사회", "집행부", "부회장", "전무"],
    priority: 6
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

describe("classifyItemText", () => {
  it("assigns issue and person tags from title and summary without dangerous labels", () => {
    const result = classifyItemText({
      title: "대한축구협회 회장 선거 선거인단 구성 관련 공식 설명",
      summary: "문체부 감사 이후 정몽규 관련 해명 키워드가 포함된 자료입니다.",
      issues,
      people,
      isOfficial: true
    });

    assert.deepEqual(result.issueTags, ["election", "audit"]);
    assert.deepEqual(result.personTags, ["person_chung"]);
    assert.ok(result.matchedKeywords.includes("대한축구협회"));
    assert.ok(result.matchedKeywords.includes("선거인단"));
    assert.ok(result.matchedKeywords.includes("정몽규"));
    assert.ok(result.relevanceScore >= 70);
    assert.equal(result.labels.includes("자동 수집"), false);
    assert.equal(result.labels.includes("논란"), false);
    assert.equal(result.labels.includes("비리"), false);
  });

  it("does not assign audit issue from local association and generic thanks text", () => {
    const result = classifyItemText({
      title: "[99.9MHz] 안광률 경기도의회 민주당 대표의원 인터뷰",
      summary:
        "그는 \"지방의회가 독립적인 예산 편성권과 감사권을 가져야 위상이 강화된다\"며 중앙당 및 정부에 이를 적극 요청했다. 시흥시 축구협회 사무국장을 오랫동안 역임한 그는 \"정치는 축구와 같은 팀 스포츠\"라고 정의했다.",
      issues,
      people,
      isOfficial: false
    });

    assert.equal(result.issueTags.includes("audit"), false);
    assert.equal(result.relevanceScore < 20, true);
  });

  it("does not assign KFA executive issue from local youth tournament roles", () => {
    const result = classifyItemText({
      title: "홍천서 경기도 U-12 상비군 선발전 개최…104개 팀 참가",
      summary:
        "경기도U-12 축구 지도자협의회 부회장인 화성시U-12 김태진 감독은 선수 발굴을 설명했다. 경기도 축구협회는 경기도 U-12 상비군 선발전을 연 2회 운영하고 있다.",
      issues,
      people,
      isOfficial: false
    });

    assert.equal(result.issueTags.includes("kfa-executives"), false);
    assert.equal(result.matchedKeywords.includes("부회장"), false);
  });

  it("assigns KFA executive issue for national association executive context", () => {
    const result = classifyItemText({
      title: "대한축구협회, 김승희 전무이사 등 집행부 회의 개최",
      summary: "정몽규 회장 체제에서 임원 인선과 이사회 운영 방향을 논의했다.",
      issues,
      people,
      isOfficial: false
    });

    assert.equal(result.issueTags.includes("kfa-executives"), true);
    assert.ok(result.matchedKeywords.includes("전무"));
    assert.ok(result.matchedKeywords.includes("집행부"));
  });

  it("assigns KFA executive issue for Park Hang-seo vice president resignation context", () => {
    const result = classifyItemText({
      title: "박항서도 축구협회 떠났다…조별리그 탈락 후 부회장직 내려놔",
      summary:
        "박 부회장은 대한 축구협회를 대표해 사과했고 지난해 제55대 집행부에 합류해 국가대표팀을 지원했다.",
      issues,
      people,
      isOfficial: false
    });

    assert.equal(result.issueTags.includes("kfa-executives"), true);
    assert.ok(result.matchedKeywords.includes("부회장"));
    assert.ok(result.matchedKeywords.includes("집행부"));
  });

  it("does not treat 'jeonmu' meaning none as an executive director role", () => {
    const result = classifyItemText({
      title: "1천억 예산의 KFA, 이름값 대신 실무 행정가에 주목",
      summary:
        "차기 대한 축구협회 수장 선거를 앞두고 하마평이 무성하다. 행정 경험이 전무한 스타 선수에게 조직을 맡기는 것은 위험하다는 지적이다.",
      issues,
      people,
      isOfficial: false
    });

    assert.equal(result.issueTags.includes("kfa-executives"), false);
    assert.equal(result.matchedKeywords.includes("전무"), false);
  });

  it("does not treat tournament participants as KFA executives", () => {
    const result = classifyItemText({
      title: "금강대기 전국 중학교 축구 대회 대진 완성 20일 킥오프",
      summary:
        "강원도민일보와 대한 축구협회가 공동 주최하고 강원도 축구협회가 공동 주관한다. 대회 기간 참가 선수와 임원, 가족 등 4000여 명이 방문한다.",
      issues,
      people,
      isOfficial: false
    });

    assert.equal(result.issueTags.includes("kfa-executives"), false);
    assert.equal(result.matchedKeywords.includes("임원"), false);
  });
});

describe("getSearchQueries", () => {
  it("combines base, issue, and person-specific queries with stable dedupe", () => {
    const queries = getSearchQueries({ issues, people });

    assert.equal(queries[0], "대한축구협회");
    assert.ok(queries.includes("축구협회 회장 선거"));
    assert.ok(queries.includes("\"정몽규\" 대한축구협회"));
    assert.equal(new Set(queries).size, queries.length);
  });

  it("adds football context to broad standalone issue keywords", () => {
    const queries = getSearchQueries({
      issues: [
        {
          id: "executives",
          name: "임원 동향",
          description: "임원 관련 이슈",
          keywords: ["임원", "이사회", "집행부"],
          priority: 1
        }
      ],
      people: []
    });

    assert.equal(queries.includes("임원"), false);
    assert.equal(queries.includes("이사회"), false);
    assert.equal(queries.includes("집행부"), false);
    assert.ok(queries.includes("축구협회 임원"));
    assert.ok(queries.includes("축구협회 이사회"));
    assert.ok(queries.includes("축구협회 집행부"));
  });
});
