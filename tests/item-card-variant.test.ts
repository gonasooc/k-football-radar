import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const itemCardSource = readFileSync(new URL("../components/ItemCard.tsx", import.meta.url), "utf8");
const homePageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const newsPageSource = readFileSync(new URL("../app/news/page.tsx", import.meta.url), "utf8");
const feedClientSource = readFileSync(
  new URL("../components/FeedClient.tsx", import.meta.url),
  "utf8"
);
const badgesSource = readFileSync(new URL("../components/Badges.tsx", import.meta.url), "utf8");
const tailwindConfigSource = readFileSync(
  new URL("../tailwind.config.ts", import.meta.url),
  "utf8"
);

describe("ItemCard variants", () => {
  it("does not expose or render a lead variant", () => {
    assert.equal(itemCardSource.includes("\"lead\""), false);
    assert.equal(itemCardSource.includes("variant === \"lead\""), false);
  });

  it("keeps article titles readable on mobile and links them to the original", () => {
    assert.match(itemCardSource, /sm:line-clamp-2/);
    assert.match(itemCardSource, /href=\{item\.url\}/);
    assert.match(itemCardSource, /새 창에서 원문 열기/);
    assert.equal(itemCardSource.match(/href=\{item\.url\}/g)?.length, 2);
    assert.doesNotMatch(itemCardSource, /원문 보기/);
    assert.doesNotMatch(itemCardSource, /title=\{item\.title\}/);
  });

  it("keeps summaries visually quieter than article titles", () => {
    assert.match(tailwindConfigSource, /summary: "oklch\(48% 0\.01 70\)"/);
    assert.match(itemCardSource, /line-clamp-2 text-sm font-medium leading-6 text-summary/);
    assert.doesNotMatch(itemCardSource, /max-w-(?:prose|\[75ch\])/);
  });

  it("highlights the applied search query in visible searchable card text", () => {
    assert.equal(itemCardSource.match(/text=\{item\.title\}/g)?.length, 2);
    assert.equal(itemCardSource.match(/text=\{item\.summary\}/g)?.length, 2);
    assert.match(itemCardSource, /text=\{item\.publisher\}/);
    assert.match(itemCardSource, /HighlightedText/);
    assert.equal(feedClientSource.match(/highlightQuery=\{query\}/g)?.length, 2);
    assert.doesNotMatch(itemCardSource, /dangerouslySetInnerHTML/);
  });

  it("keeps a minimal relevance score beside the issue and person tags", () => {
    const metadataRowSource = itemCardSource.slice(
      itemCardSource.indexOf("const metadataRow"),
      itemCardSource.indexOf("const tagRow")
    );
    const tagRowSource = itemCardSource.slice(
      itemCardSource.indexOf("const tagRow"),
      itemCardSource.indexOf('if (variant === "compact")')
    );

    assert.doesNotMatch(metadataRowSource, /relevanceScore/);
    assert.match(tagRowSource, /flex min-w-0 flex-wrap items-center gap-1\.5/);
    assert.match(tagRowSource, /관련도 \$\{item\.relevanceScore\}점/);
    assert.match(tagRowSource, /\{item\.relevanceScore\}/);
    assert.match(tagRowSource, /metric-tabular font-black text-ink-soft/);
    assert.doesNotMatch(itemCardSource, /감지 키워드/);
    assert.doesNotMatch(itemCardSource, /formatDateTime/);
  });

  it("hides diagnostic collection labels from article badges", () => {
    assert.match(itemCardSource, /DIAGNOSTIC_LABELS/);
    assert.match(itemCardSource, /자동 수집/);
    assert.match(itemCardSource, /인물 언급/);
    assert.match(itemCardSource, /visibleLabels/);
    assert.doesNotMatch(itemCardSource, /hiddenTagCount/);
  });

  it("marks secondary collection items with a neutral label", () => {
    assert.match(itemCardSource, /relevanceTier === "secondary"/);
    assert.match(itemCardSource, /보조 수집/);
  });

  it("keeps interactive article tags at the product touch-target size", () => {
    assert.equal(badgesSource.match(/min-h-11/g)?.length, 2);
  });

  it("exposes a primary and all scope control in the feed", () => {
    assert.match(feedClientSource, /scopeFilter/);
    assert.match(feedClientSource, /범위/);
    assert.match(feedClientSource, /주요/);
    assert.match(feedClientSource, /전체/);
  });

  it("explains the scope control without exposing internal tier names", () => {
    assert.match(feedClientSource, /"채널 범위 설명" : "수집 범위 설명"/);
    assert.match(feedClientSource, /aria-expanded=\{showScopeHelp\}/);
    assert.match(feedClientSource, /aria-describedby=\{showScopeHelp \? SCOPE_HELP_ID : undefined\}/);
    assert.match(feedClientSource, /role="tooltip"/);
    assert.match(feedClientSource, /event\.key === "Escape"/);
    assert.match(feedClientSource, /onKeyDown=\{closeScopeHelpOnEscape\}/);
    assert.match(feedClientSource, /onFocus=\{\(\) => setShowScopeHelp\(true\)\}/);
    assert.match(feedClientSource, /onClick=\{\(\) => setShowScopeHelp\(true\)\}/);
    assert.match(feedClientSource, /onBlur=\{\(\) => setShowScopeHelp\(false\)\}/);
    assert.match(feedClientSource, /absolute right-0 top-10 z-40/);
    assert.doesNotMatch(feedClientSource, /mt-3 max-w-3xl border-t border-line/);
    assert.match(feedClientSource, /주요는 관련도가 높은 기본 수집 항목만 보여줍니다/);
    assert.match(feedClientSource, /전체는 보조 수집 항목까지 포함합니다/);
    assert.match(feedClientSource, /검색어가 있으면 보조 수집도 함께 찾습니다/);
  });

  it("keeps the feed controls visually compact", () => {
    assert.match(feedClientSource, /aria-label="피드 필터"/);
    assert.match(feedClientSource, /min-\[360px\]:grid-cols-\[minmax\(0,1fr\)_auto\]/);
    assert.match(feedClientSource, /lg:grid-cols-\[minmax\(260px,1fr\)_260px_auto\]/);
    assert.match(feedClientSource, /lg:grid-cols-\[minmax\(260px,1fr\)_auto\]/);
    assert.match(feedClientSource, /showTypeFilter/);
    assert.match(feedClientSource, /sr-only">검색/);
    assert.match(feedClientSource, /h-11 w-full/);
    assert.match(feedClientSource, /min-h-11 text-xs font-black/);
    assert.match(feedClientSource, /aria-label="자료 유형"/);
    assert.match(feedClientSource, /aria-pressed=\{selected\}/);
    assert.match(feedClientSource, /상세 필터/);
    assert.match(feedClientSource, /aria-controls=\{ADVANCED_FILTERS_ID\}/);
    assert.match(feedClientSource, /aria-label="모바일 자료 유형"/);
    assert.match(feedClientSource, /size-11 items-center justify-center/);
  });

  it("exposes latest and relevance sorting in the feed", () => {
    assert.match(feedClientSource, /sortOrder/);
    assert.match(feedClientSource, /정렬/);
    assert.match(feedClientSource, /최신순/);
    assert.match(feedClientSource, /관련도순/);
  });

  it("renders separate home previews and moves the searchable feed to news", () => {
    assert.equal(homePageSource.match(/limit: 6/g)?.length, 2);
    assert.equal(homePageSource.match(/<HomeFeedSection/g)?.length, 2);
    assert.match(homePageSource, /href="\/news"/);
    assert.match(homePageSource, /href="\/youtube"/);
    assert.doesNotMatch(homePageSource, /같은 사건의 보도를 묶어/);
    assert.doesNotMatch(homePageSource, /제목과 설명에서 추적 이슈가 확인된/);
    assert.doesNotMatch(homePageSource, /<FeedClient/);

    assert.match(newsPageSource, /toFeedItems\(newsItems\)/);
    assert.match(newsPageSource, /<SectionHeader/);
    assert.match(newsPageSource, /title="뉴스"/);
    assert.match(newsPageSource, /description="한국축구 이슈와 관련된 뉴스와 공식자료를 검색하고 확인합니다\."/);
    assert.match(newsPageSource, /<FeedClient/);
    assert.match(newsPageSource, /mode="news"/);
  });
});
