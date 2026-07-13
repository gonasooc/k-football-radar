import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { FeedClient } from "../components/FeedClient";
import type { FeedPage } from "../lib/feed-page";
import { defaultFeedFilters, type FeedItem } from "../lib/filter";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const directSearchItem: FeedItem = {
  id: "direct-search",
  title: "감독 선임 절차 관련 기사",
  summary: "공유 검색 주소의 첫 결과",
  url: "https://example.com/direct-search",
  publisher: "테스트뉴스",
  publishedAt: "2026-07-13T00:00:00.000Z",
  collectedAt: "2026-07-13T00:10:00.000Z",
  issueTags: [],
  personTags: [],
  sourceType: "news",
  relevanceScore: 60,
  searchTerms: "감독 선임"
};

describe("FeedClient server render", () => {
  it("renders direct URL filter state and only the supplied first page", () => {
    const initialPage: FeedPage = {
      items: [directSearchItem],
      total: 42,
      offset: 0,
      limit: 30,
      hasMore: true,
      snapshot: "2026-07-13T01:14:31.959Z"
    };
    const markup = renderToStaticMarkup(
      React.createElement(FeedClient, {
        initialFilters: { ...defaultFeedFilters, query: "감독 선임" },
        initialPage,
        issues: [],
        people: []
      })
    );

    assert.match(markup, /value="감독 선임"/);
    assert.match(markup, /<mark[^>]*>감독 선임<\/mark> 절차 관련 기사/);
    assert.match(markup, /42개 결과/);
    assert.match(markup, /1개 표시/);
    assert.match(markup, />더보기</);
  });
});
