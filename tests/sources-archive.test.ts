import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const sourcesPageSource = readFileSync(
  new URL("../app/sources/page.tsx", import.meta.url),
  "utf8"
);
const sourcesArchiveClientSource = readFileSync(
  new URL("../components/SourcesArchiveClient.tsx", import.meta.url),
  "utf8"
);

describe("Sources archive page", () => {
  it("uses progressive disclosure for publisher stats and original links", () => {
    assert.match(sourcesPageSource, /<PublisherStatsPanel/);
    assert.match(sourcesPageSource, /<SourceLinksList/);
    assert.doesNotMatch(sourcesPageSource, /출처 원장/);

    assert.match(sourcesArchiveClientSource, /PUBLISHER_PREVIEW_COUNT = 10/);
    assert.match(sourcesArchiveClientSource, /전체 보기/);
    assert.match(sourcesArchiveClientSource, /상위 10개/);

    assert.match(sourcesArchiveClientSource, /LINK_PAGE_SIZE = 30/);
    assert.match(sourcesArchiveClientSource, /더보기/);
    assert.match(sourcesArchiveClientSource, /setVisibleCount/);
  });
});
