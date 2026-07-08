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

  it("renders the home page latest items as one compact grid", () => {
    assert.equal(homePageSource.includes("primaryItem"), false);
    assert.equal(homePageSource.includes("secondaryItems"), false);
    assert.equal(homePageSource.includes("remainingItems"), false);

    const latestGridBlock = homePageSource.match(/latestGridItems\.map\(\(item\) => \(([\s\S]*?)\s+\)\)/);

    assert.ok(latestGridBlock);
    assert.match(latestGridBlock[1], /variant="compact"/);
    assert.doesNotMatch(latestGridBlock[1], /variant="lead"/);
  });
});
