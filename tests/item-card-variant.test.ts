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
