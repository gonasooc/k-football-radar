import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const itemCardSource = readFileSync(new URL("../components/ItemCard.tsx", import.meta.url), "utf8");
const homePageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

describe("ItemCard variants", () => {
  it("does not expose or render a lead variant", () => {
    assert.equal(itemCardSource.includes("\"lead\""), false);
    assert.equal(itemCardSource.includes("variant === \"lead\""), false);
  });

  it("clamps article titles to two lines in card layouts", () => {
    assert.match(itemCardSource, /line-clamp-2 text-xl font-black/);
    assert.match(itemCardSource, /title=\{item\.title\}/);
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

  it("renders the home page as the searchable latest feed", () => {
    assert.equal(homePageSource.includes("primaryItem"), false);
    assert.equal(homePageSource.includes("secondaryItems"), false);
    assert.equal(homePageSource.includes("remainingItems"), false);
    assert.equal(homePageSource.includes("latestGridItems"), false);
    assert.equal(homePageSource.includes("moreItems"), false);
    assert.equal(homePageSource.includes("최신 큐"), false);
    assert.equal(homePageSource.includes("전체 피드"), false);

    assert.match(homePageSource, /<FeedClient/);
  });
});
