import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

describe("Root layout header", () => {
  it("uses a compact left-logo and right-copy header", () => {
    assert.match(layoutSource, /items-end justify-between/);
    assert.match(layoutSource, /aria-label="Korea Football Radar 홈"/);
    assert.match(layoutSource, /w-\[190px\] max-w-\[calc\(100vw-2rem\)\] sm:w-\[220px\] lg:w-\[250px\]/);
    assert.match(layoutSource, /hidden max-w-md text-right/);
    assert.match(layoutSource, /mx-auto inline-flex shrink-0 items-center lg:mx-0/);
    assert.match(layoutSource, /한국축구 이슈와 공식자료를 한곳에 모은 뉴스 레이더/);
    assert.doesNotMatch(layoutSource, /text-center/);
    assert.doesNotMatch(layoutSource, /max-w-\[720px\]/);
  });

  it("loads the configured Pretendard variable font", () => {
    assert.match(
      layoutSource,
      /pretendard\/dist\/web\/variable\/pretendardvariable-dynamic-subset\.css/
    );
  });

  it("provides a skip link, main target, and route title template", () => {
    assert.match(layoutSource, /href="#main-content"/);
    assert.match(layoutSource, /id="main-content"/);
    assert.match(layoutSource, /본문으로 건너뛰기/);
    assert.match(layoutSource, /template: `%s \| \$\{siteName\}`/);
  });
});
