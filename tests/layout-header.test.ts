import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

describe("Root layout header", () => {
  it("uses a compact left-logo and right-copy header", () => {
    assert.match(layoutSource, /items-end justify-between/);
    assert.match(layoutSource, /aria-label="Korea Football Radar 홈"/);
    assert.match(layoutSource, /w-\[200px\] sm:w-\[240px\] lg:w-\[280px\]/);
    assert.match(layoutSource, /hidden max-w-md text-right/);
    assert.match(layoutSource, /한국축구 이슈와 공식자료를 한곳에 모은 뉴스 레이더/);
    assert.doesNotMatch(layoutSource, /text-center/);
    assert.doesNotMatch(layoutSource, /max-w-\[720px\]/);
  });
});
