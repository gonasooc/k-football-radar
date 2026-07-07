import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveSourceUrl, shouldKeepOfficialCandidate } from "../scripts/collect-official";

describe("resolveSourceUrl", () => {
  it("accepts only http and https links", () => {
    assert.equal(resolveSourceUrl("/notice/1", "https://media.kfa.or.kr/"), "https://media.kfa.or.kr/notice/1");
    assert.equal(resolveSourceUrl("javascript:void(0);", "https://media.kfa.or.kr/"), null);
    assert.equal(resolveSourceUrl("mailto:test@example.com", "https://media.kfa.or.kr/"), null);
  });
});

describe("shouldKeepOfficialCandidate", () => {
  it("rejects organization-only navigation links without issue or person tags", () => {
    assert.equal(
      shouldKeepOfficialCandidate({
        classification: {
          issueTags: [],
          personTags: [],
          matchedKeywords: ["KFA"],
          relevanceScore: 40,
          labels: ["공식 출처", "자동 수집"]
        },
        sourceId: "kfa_media"
      }),
      false
    );
    assert.equal(
      shouldKeepOfficialCandidate({
        classification: {
          issueTags: ["election"],
          personTags: [],
          matchedKeywords: ["대한축구협회장"],
          relevanceScore: 70,
          labels: ["공식 출처", "자동 수집"]
        },
        sourceId: "sports_council"
      }),
      true
    );
    assert.equal(
      shouldKeepOfficialCandidate({
        classification: {
          issueTags: ["youth-governance"],
          personTags: [],
          matchedKeywords: ["유소년"],
          relevanceScore: 45,
          labels: ["공식 출처", "자동 수집"]
        },
        sourceId: "sports_council"
      }),
      false
    );
  });
});
