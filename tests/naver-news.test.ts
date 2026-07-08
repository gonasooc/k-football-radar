import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_NAVER_QUERY_DELAY_MS,
  filterNewsItemsForCollection,
  getNaverQueryDelayMs,
  shouldKeepNewsCandidate
} from "../scripts/collect-naver-news";
import type { RadarItem } from "../lib/schema";

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
