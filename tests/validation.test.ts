import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateDataBundle } from "../lib/validation";
import type { CollectionState, Issue, Person, RadarItem, Source } from "../lib/schema";

const issues: Issue[] = [
  {
    id: "election",
    name: "회장 선거",
    description: "대한축구협회장 선거 관련 이슈",
    keywords: ["회장 선거"],
    priority: 1
  }
];

const people: Person[] = [
  {
    id: "person_a",
    name: "인물 A",
    aliases: [],
    role: "관련 인물",
    keywords: ["인물 A"],
    priority: 1,
    published: true
  }
];

const sources: Source[] = [
  {
    id: "official",
    name: "공식자료",
    type: "official",
    url: "https://example.com/source",
    enabled: true
  }
];

const state: CollectionState = {
  lastCollectedAt: "2026-07-07T00:00:00.000Z",
  lastRunStatus: "success",
  lastRunNewItems: 1,
  totalItems: 1
};

function item(id: string, override: Partial<RadarItem> = {}): RadarItem {
  return {
    id,
    type: "news",
    title: "대한축구협회 회장 선거 관련 메타데이터",
    summary: "짧은 설명",
    url: `https://example.com/${id}`,
    originalUrl: `https://example.com/${id}`,
    publisher: "테스트뉴스",
    publishedAt: "2026-07-07T00:00:00.000Z",
    collectedAt: "2026-07-07T00:10:00.000Z",
    matchedKeywords: ["대한축구협회"],
    issueTags: ["election"],
    personTags: [],
    sourceType: "news",
    isOfficial: false,
    relevanceScore: 40,
    labels: ["자동 수집"],
    ...override
  };
}

describe("validateDataBundle", () => {
  it("rejects dangerous automatic labels", () => {
    assert.throws(
      () =>
        validateDataBundle({
          items: [item("bad_label", { labels: ["비리"] })],
          issues,
          people,
          sources,
          collectionState: state
        }),
      /Dangerous label/
    );
  });

  it("rejects canonical duplicate URLs", () => {
    assert.throws(
      () =>
        validateDataBundle({
          items: [
            item("one", { url: "https://example.com/story?utm_source=x" }),
            item("two", { url: "https://example.com/story" })
          ],
          issues,
          people,
          sources,
          collectionState: { ...state, totalItems: 2 }
        }),
      /Duplicate canonical item url/
    );
  });
});
