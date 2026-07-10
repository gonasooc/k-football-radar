import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const appNavSource = readFileSync(new URL("../components/AppNav.tsx", import.meta.url), "utf8");

describe("AppNav", () => {
  it("shows the primary nav from the same breakpoint that hides the fixed mobile nav", () => {
    const primaryNavClass = appNavSource.match(
      /<nav\s+className="([^"]+)"\s+aria-label="주요 화면"/
    )?.[1];
    const fixedNavClass = appNavSource.match(
      /aria-label="모바일 주요 화면"\s+className="([^"]+)"/
    )?.[1];

    assert.ok(primaryNavClass);
    assert.ok(fixedNavClass);
    assert.match(primaryNavClass, /(?:^|\s)hidden(?:\s|$)/);
    assert.match(primaryNavClass, /(?:^|\s)sm:block(?:\s|$)/);
    assert.match(fixedNavClass, /(?:^|\s)block(?:\s|$)/);
    assert.match(fixedNavClass, /(?:^|\s)sm:hidden(?:\s|$)/);
  });

  it("keeps the fixed mobile nav visible without scroll state", () => {
    const fixedNavClass = appNavSource.match(
      /aria-label="모바일 주요 화면"\s+className="([^"]+)"/
    )?.[1];

    assert.ok(fixedNavClass);
    assert.match(fixedNavClass, /(?:^|\s)fixed(?:\s|$)/);
    assert.match(fixedNavClass, /(?:^|\s)block(?:\s|$)/);
    assert.match(fixedNavClass, /(?:^|\s)sm:hidden(?:\s|$)/);
    assert.equal(appNavSource.includes("scrollY"), false);
    assert.equal(appNavSource.includes("addEventListener(\"scroll\""), false);
  });
});
