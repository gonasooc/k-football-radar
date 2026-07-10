import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const loadingSource = readFileSync(new URL("../app/loading.tsx", import.meta.url), "utf8");
const loadingSkeletonsSource = readFileSync(
  new URL("../components/LoadingSkeletons.tsx", import.meta.url),
  "utf8"
);

describe("Route loading UI", () => {
  it("replaces the visible loading message with an accessible skeleton", () => {
    assert.match(loadingSource, /role="status"/);
    assert.match(loadingSource, /aria-live="polite"/);
    assert.match(loadingSource, /className="sr-only">자료를 불러오는 중입니다/);
    assert.match(loadingSource, /aria-hidden="true"/);
    assert.match(loadingSource, /motion-safe:animate-pulse/);
    assert.doesNotMatch(loadingSource, /<p/);
  });

  it("mirrors the dashboard, filter, and article feed layout", () => {
    assert.match(loadingSource, /STAT_SKELETONS = \[0, 1, 2, 3\]/);
    assert.match(loadingSkeletonsSource, /FEATURED_SKELETONS = \[0, 1, 2\]/);
    assert.match(loadingSkeletonsSource, /LIST_SKELETONS = \[0, 1\]/);
    assert.match(loadingSource, /md:grid-cols-4/);
    assert.match(loadingSource, /lg:grid-cols-\[minmax\(260px,1fr\)_260px_auto\]/);
    assert.match(loadingSkeletonsSource, /lg:grid-cols-3/);
    assert.match(loadingSkeletonsSource, /<ArticleSkeleton compact/);
    assert.match(loadingSource, /<FeedResultsSkeleton animated=\{false\}/);
  });
});
