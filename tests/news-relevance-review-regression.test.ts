import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { classifyItemText } from "../lib/classify";
import type { Issue, Person } from "../lib/schema";
import { getNewsCandidateRelevanceTier } from "../scripts/collect-naver-news";

const issues = JSON.parse(
  readFileSync(new URL("../data/issues.json", import.meta.url), "utf8")
) as Issue[];
const people = JSON.parse(
  readFileSync(new URL("../data/people.json", import.meta.url), "utf8")
) as Person[];

function classifyArticle(article: { title: string; summary: string }) {
  const classification = classifyItemText({
    ...article,
    issues,
    people,
    isOfficial: false
  });

  return {
    classification,
    tier: getNewsCandidateRelevanceTier({ ...article, classification })
  };
}

describe("reviewed news relevance regressions", () => {
  it("rejects an unrelated headline when the summary lead only names KFA", () => {
    const article = {
      title: "아시안게임 선수 명단 발표",
      summary: "KFA는 이날 명단을 발표했다. 자세한 내용은 추후 공개할 예정이다."
    };

    const { classification, tier } = classifyArticle(article);

    assert.deepEqual(classification.issueTags, []);
    assert.deepEqual(classification.personTags, []);
    assert.equal(tier, "reject");
  });

  it("does not classify a KBO personnel photo as a football coach appointment", () => {
    const article = {
      title: "[사진]올스타전 찾은 조계현 전력강화위원장-류지현 감독",
      summary:
        "조계현 KBO 전력강화위원장과 류지현 야구 대표팀 감독이 프로야구 올스타전을 관전하고 있다."
    };

    const { classification, tier } = classifyArticle(article);

    assert.equal(classification.issueTags.includes("coach-appointment"), false);
    assert.equal(tier, "reject");
  });

  it("does not combine foreign-club youth work with a separate past KFA biography", () => {
    const article = {
      title: "이임생, 캄보디아 프로팀 기술이사 취임",
      summary:
        "현지 구단에서 선수 육성과 코칭 시스템 구축을 맡는다. 그는 과거 대한축구협회 기술이사로 일했다."
    };

    const { classification } = classifyArticle(article);

    assert.equal(classification.issueTags.includes("youth-governance"), false);
  });
});
