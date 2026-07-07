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
    assert.equal(result.labels.includes("논란"), false);
    assert.equal(result.labels.includes("비리"), false);
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
});
