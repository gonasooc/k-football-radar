import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { StoryFeedEntryCard } from "../components/StoryFeedEntryCard";
import type { StoryFeedEntry } from "../lib/feed-page";
import type { FeedItem } from "../lib/filter";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const representative: FeedItem = {
  id: "representative",
  title: "축구 행정 제도 개선 핵심 보도",
  summary: "같은 사건을 다룬 기사 묶음의 대표 요약입니다.",
  url: "https://example.com/representative",
  publisher: "대표뉴스",
  publishedAt: "2026-07-17T06:00:00.000Z",
  collectedAt: "2026-07-17T06:10:00.000Z",
  issueTags: [],
  personTags: [],
  sourceType: "news",
  relevanceScore: 80,
  relevanceTier: "primary",
  labels: [],
  searchTerms: "축구 행정"
};

function entry(relatedCount: number): StoryFeedEntry {
  return {
    id: "story-representative",
    representative,
    related: Array.from({ length: relatedCount }, (_, index) => ({
      id: `related-${index + 1}`,
      title: `관련 기사 ${index + 1}`,
      url: `https://example.com/related-${index + 1}`,
      publisher: `관련뉴스 ${index + 1}`,
      publishedAt: `2026-07-17T0${index + 1}:00:00.000Z`
    })),
    itemCount: relatedCount + 1,
    latestPublishedAt: "2026-07-17T06:00:00.000Z",
    maxRelevanceScore: 80
  };
}

describe("grouped feed editorial UI", () => {
  it("leaves singleton entries on the existing article treatment", () => {
    const markup = renderToStaticMarkup(
      React.createElement(StoryFeedEntryCard, {
        entry: entry(0),
        issues: [],
        people: []
      })
    );

    assert.match(markup, /축구 행정 제도 개선 핵심 보도/);
    assert.doesNotMatch(markup, /대표 기사/);
    assert.doesNotMatch(markup, /관련 기사/);
  });

  it("shows two slim related links and an accessible inline expansion control", () => {
    const markup = renderToStaticMarkup(
      React.createElement(StoryFeedEntryCard, {
        entry: entry(4),
        issues: [],
        people: []
      })
    );

    assert.match(markup, /대표 기사/);
    assert.doesNotMatch(markup, />관련 기사<\/span>/);
    assert.match(markup, /관련 기사 1/);
    assert.match(markup, /관련 기사 2/);
    assert.doesNotMatch(markup, /관련 기사 3/);
    assert.doesNotMatch(markup, /관련 기사 4/);
    assert.match(markup, /aria-expanded="false"/);
    assert.match(markup, /aria-controls=/);
    assert.match(
      markup,
      /aria-label="관련 기사 2건 더보기: 축구 행정 제도 개선 핵심 보도"/
    );
    assert.match(markup, /role="group"/);
    assert.match(markup, />2건 더보기</);
    assert.match(markup, /min-h-11/);
  });

  it("keeps grouped entries flat and image-free", () => {
    const source = readFileSync(
      new URL("../components/StoryFeedEntryCard.tsx", import.meta.url),
      "utf8"
    );

    assert.match(source, /divide-y divide-line/);
    assert.match(source, /border-l-2 border-line/);
    assert.doesNotMatch(source, /rounded-(?:panel|card)/);
    assert.doesNotMatch(source, /<Image|<img/);
    assert.match(source, /RELATED_PREVIEW_COUNT = 2/);
    assert.match(source, /firstExpandedNewsRef\.current\?\.focus\(\)/);
  });

  it("keeps detail-page totals in the client state that handles snapshot recovery", () => {
    const paginatedSource = readFileSync(
      new URL("../components/PaginatedItemList.tsx", import.meta.url),
      "utf8"
    );
    const issuePageSource = readFileSync(
      new URL("../app/issues/[id]/page.tsx", import.meta.url),
      "utf8"
    );
    const personPageSource = readFileSync(
      new URL("../app/people/[id]/page.tsx", import.meta.url),
      "utf8"
    );

    assert.match(paginatedSource, /\{results\.totalEntries\}개 주제·자료/);
    assert.match(paginatedSource, /원문 \{results\.totalItems\}건/);
    assert.match(paginatedSource, /aria-live="polite"/);
    assert.doesNotMatch(issuePageSource, /initialPage\.total(?:Entries|Items)/);
    assert.doesNotMatch(personPageSource, /initialPage\.total(?:Entries|Items)/);
  });
});
