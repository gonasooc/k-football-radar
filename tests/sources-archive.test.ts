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

    assert.match(sourcesArchiveClientSource, /PUBLISHER_PREVIEW_COUNT = 5/);
    assert.match(sourcesArchiveClientSource, /전체 보기/);
    assert.match(sourcesArchiveClientSource, /상위 5개/);

    assert.match(sourcesArchiveClientSource, /LINK_PAGE_SIZE = 30/);
    assert.match(sourcesArchiveClientSource, /더보기/);
    assert.match(sourcesArchiveClientSource, /setVisibleCount/);
  });

  it("sends only the fields needed by the client-side source ledger", () => {
    assert.match(sourcesPageSource, /const sourceLinkItems = data\.items\.map/);
    assert.match(sourcesPageSource, /\{ id, url, title, publisher, publishedAt \}/);
    assert.match(sourcesPageSource, /<SourceLinksList items=\{sourceLinkItems\}/);
    assert.doesNotMatch(sourcesPageSource, /<SourceLinksList items=\{data\.items\}/);
    assert.match(sourcesArchiveClientSource, /min-h-11/);
    assert.match(sourcesArchiveClientSource, /aria-live="polite"/);
    assert.ok(
      sourcesPageSource.indexOf("<SourceLinksList") <
        sourcesPageSource.indexOf('aria-labelledby="collection-sources-heading"')
    );
  });

  it("keeps collection and publisher section headers at the same height", () => {
    const sharedHeaderClass =
      "min-h-14 items-center justify-between gap-3 border-b border-line px-2 py-1";

    assert.match(sourcesPageSource, new RegExp(sharedHeaderClass));
    assert.match(sourcesArchiveClientSource, new RegExp(sharedHeaderClass));
  });
});
