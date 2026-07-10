import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const trackingSource = readFileSync(
  new URL("../app/tracking/page.tsx", import.meta.url),
  "utf8"
);
const issueDetailSource = readFileSync(
  new URL("../app/issues/[id]/page.tsx", import.meta.url),
  "utf8"
);
const personDetailSource = readFileSync(
  new URL("../app/people/[id]/page.tsx", import.meta.url),
  "utf8"
);

describe("Tracking UI", () => {
  it("uses standard navigation semantics for issue and people views", () => {
    assert.match(trackingSource, /<nav aria-label="트래킹 보기"/);
    assert.match(trackingSource, /aria-current=\{active \? "page" : undefined\}/);
    assert.doesNotMatch(trackingSource, /role="tab(?:list)?"/);
    assert.doesNotMatch(trackingSource, /순위/);
  });

  it("keeps detail metadata in simple ruled ledgers with route titles", () => {
    for (const source of [issueDetailSource, personDetailSource]) {
      assert.match(source, /generateMetadata/);
      assert.match(source, /border-y border-rule/);
      assert.doesNotMatch(source, /shadow-panel/);
      assert.doesNotMatch(source, /rounded-panel/);
    }
  });

  it("uses context-specific empty state guidance on detail pages", () => {
    assert.match(issueDetailSource, /새 자료가 수집되면 이 이슈 화면에 자동으로 표시됩니다/);
    assert.match(personDetailSource, /새 자료에서 이 인물이 감지되면 이 화면에 자동으로 표시됩니다/);
  });
});
