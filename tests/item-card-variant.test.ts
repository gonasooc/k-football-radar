import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const itemCardSource = readFileSync(new URL("../components/ItemCard.tsx", import.meta.url), "utf8");
const homePageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const feedClientSource = readFileSync(
  new URL("../components/FeedClient.tsx", import.meta.url),
  "utf8"
);
const tailwindConfigSource = readFileSync(
  new URL("../tailwind.config.ts", import.meta.url),
  "utf8"
);

describe("ItemCard variants", () => {
  it("does not expose or render a lead variant", () => {
    assert.equal(itemCardSource.includes("\"lead\""), false);
    assert.equal(itemCardSource.includes("variant === \"lead\""), false);
  });

  it("clamps article titles to two lines in card layouts", () => {
    assert.match(itemCardSource, /line-clamp-2 text-xl font-black/);
    assert.match(itemCardSource, /title=\{item\.title\}/);
  });

  it("keeps summaries visually quieter than article titles", () => {
    assert.match(itemCardSource, /line-clamp-2 text-xl font-black leading-snug text-ink/);
    assert.match(tailwindConfigSource, /summary: "oklch\(48% 0\.01 70\)"/);
    assert.match(itemCardSource, /line-clamp-3 text-sm font-medium leading-7 text-summary/);
    assert.match(itemCardSource, /max-w-4xl text-sm font-medium leading-7 text-summary/);
  });

  it("keeps relevance visible before clamped detected keywords", () => {
    assert.match(itemCardSource, /관련도 \{item\.relevanceScore\}/);
    assert.match(itemCardSource, /감지 키워드: \{keywordText\}/);
    assert.match(itemCardSource, /grid-cols-\[auto_minmax\(0,1fr\)\]/);
  });

  it("hides the automatic collection label from article badges", () => {
    assert.match(itemCardSource, /HIDDEN_LABELS/);
    assert.match(itemCardSource, /자동 수집/);
    assert.match(itemCardSource, /visibleLabels/);
  });

  it("marks secondary collection items with a neutral label", () => {
    assert.match(itemCardSource, /relevanceTier === "secondary"/);
    assert.match(itemCardSource, /보조 수집/);
  });

  it("exposes a primary and all scope control in the feed", () => {
    assert.match(feedClientSource, /scopeFilter/);
    assert.match(feedClientSource, /범위/);
    assert.match(feedClientSource, /주요/);
    assert.match(feedClientSource, /전체/);
  });

  it("explains the scope control without exposing internal tier names", () => {
    assert.match(feedClientSource, /범위 필터 설명/);
    assert.match(feedClientSource, /role="tooltip"/);
    assert.match(feedClientSource, /주요는 관련도가 높은 기본 수집 항목만 보여줍니다/);
    assert.match(feedClientSource, /전체는 보조 수집 항목까지 포함합니다/);
    assert.match(feedClientSource, /검색어가 있으면 보조 수집도 함께 찾습니다/);
  });

  it("keeps the feed controls visually compact", () => {
    assert.match(feedClientSource, /bg-canvas py-3/);
    assert.match(feedClientSource, /flex flex-wrap items-center gap-2 xl:flex-nowrap/);
    assert.match(feedClientSource, /sr-only">검색/);
    assert.match(feedClientSource, /border-r border-line bg-paper px-2 text-\[11px\] font-black text-muted/);
    assert.match(feedClientSource, /h-10 w-full/);
    assert.match(feedClientSource, /min-h-10 text-xs font-black/);
    assert.match(feedClientSource, /aria-label="유형"/);
    assert.match(feedClientSource, /focus-within:outline/);
    assert.doesNotMatch(feedClientSource, /grid-cols-\[2\.75rem_minmax\(0,1fr\)\]/);
    assert.doesNotMatch(feedClientSource, /bg-paper\/45 px-4 py-4/);
    assert.doesNotMatch(feedClientSource, /text-\[11px\] font-black text-ink\/55/);
  });

  it("exposes latest and relevance sorting in the feed", () => {
    assert.match(feedClientSource, /sortOrder/);
    assert.match(feedClientSource, /정렬/);
    assert.match(feedClientSource, /최신순/);
    assert.match(feedClientSource, /관련도순/);
  });

  it("renders the home page as the searchable latest feed", () => {
    assert.equal(homePageSource.includes("primaryItem"), false);
    assert.equal(homePageSource.includes("secondaryItems"), false);
    assert.equal(homePageSource.includes("remainingItems"), false);
    assert.equal(homePageSource.includes("latestGridItems"), false);
    assert.equal(homePageSource.includes("moreItems"), false);
    assert.equal(homePageSource.includes("최신 큐"), false);
    assert.equal(homePageSource.includes("최신 기사"), false);
    assert.equal(homePageSource.includes("전체 피드"), false);

    assert.match(homePageSource, /<FeedClient/);
  });
});
