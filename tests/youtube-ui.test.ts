import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const cardSource = readFileSync(
  new URL("../components/YouTubeCard.tsx", import.meta.url),
  "utf8"
);
const storyCardSource = readFileSync(
  new URL("../components/StoryFeedEntryCard.tsx", import.meta.url),
  "utf8"
);
const nextConfigSource = readFileSync(
  new URL("../next.config.ts", import.meta.url),
  "utf8"
);
const homeSectionSource = readFileSync(
  new URL("../components/HomeFeedSection.tsx", import.meta.url),
  "utf8"
);

describe("YouTube feed UI", () => {
  it("routes YouTube entries to a media-aware card with the editorial metadata rhythm", () => {
    assert.match(storyCardSource, /entry\.representative\.sourceType === "youtube"/);
    assert.match(storyCardSource, /<YouTubeCard/);
    assert.match(cardSource, /<SourceBadge item=\{item\}/);
    assert.match(cardSource, /<HighlightedText query=\{highlightQuery\} text=\{item\.publisher\}/);
    assert.match(cardSource, /<HighlightedText query=\{highlightQuery\} text=\{item\.title\}/);
    assert.match(cardSource, /formatDuration\(item\.youtube\.durationSeconds\)/);
    assert.match(cardSource, /aspect-video/);
    assert.match(cardSource, /sm:grid-cols-\[220px_minmax\(0,1fr\)\]/);
    assert.match(cardSource, /새 창에서 유튜브 영상 열기/);
  });

  it("keeps thumbnail failure handling and the YouTube image host explicit", () => {
    assert.match(cardSource, /onError=\{\(\) => setFailed\(true\)\}/);
    assert.match(cardSource, /썸네일을 불러오지 못했습니다/);
    assert.match(nextConfigSource, /hostname: "i\.ytimg\.com"/);
    assert.match(nextConfigSource, /pathname: "\/vi\/\*\*"/);
  });

  it("reuses the same six-item section composition for home news and video previews", () => {
    assert.match(homeSectionSource, /page\.entries\.slice\(0, 3\)/);
    assert.match(homeSectionSource, /page\.entries\.slice\(3, 6\)/);
    assert.match(homeSectionSource, /aria-label=\{`\$\{title\} 더보기`\}/);
    assert.match(homeSectionSource, />\s*더보기\s*<ArrowRight/);
    assert.match(homeSectionSource, /<StoryFeedEntryCard/);
  });
});
