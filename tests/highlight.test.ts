import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { HighlightedText } from "../components/HighlightedText";
import { getHighlightParts } from "../lib/highlight";

function highlightedText(text: string, query: string): string[] {
  return getHighlightParts(text, query)
    .filter((part) => part.highlighted)
    .map((part) => part.text);
}

describe("getHighlightParts", () => {
  it("returns the original text when the query is empty or absent", () => {
    assert.deepEqual(getHighlightParts("홍명보 감독", "  "), [
      { highlighted: false, start: 0, text: "홍명보 감독" }
    ]);
    assert.deepEqual(getHighlightParts("홍명보 감독", "정몽규"), [
      { highlighted: false, start: 0, text: "홍명보 감독" }
    ]);
  });

  it("highlights every case-insensitive match while preserving original casing", () => {
    assert.deepEqual(highlightedText("KFA kfa Kfa", "kFa"), ["KFA", "kfa", "Kfa"]);
  });

  it("highlights the trimmed full phrase without splitting it into tokens", () => {
    const text = "감독 선임 절차와 감독 선임 결과";

    assert.deepEqual(highlightedText(text, "  감독 선임  "), ["감독 선임", "감독 선임"]);
    assert.deepEqual(highlightedText("감독 검증 뒤 선임", "감독 선임"), []);
  });

  it("treats regular expression characters as literal search text", () => {
    const specialQuery = ".*+?^${}()|[]\\";
    const text = `앞 ${specialQuery} 뒤`;

    assert.deepEqual(highlightedText(text, specialQuery), [specialQuery]);
    assert.equal(
      getHighlightParts(text, specialQuery)
        .map((part) => part.text)
        .join(""),
      text
    );
  });

  it("renders semantic marks without injecting source text as HTML", () => {
    const markup = renderToStaticMarkup(
      createElement(HighlightedText, {
        query: "홍명보",
        text: "<홍명보>와 홍명보"
      })
    );

    assert.equal(markup.match(/<mark/g)?.length, 2);
    assert.match(markup, /bg-accent-soft/);
    assert.match(markup, /&lt;<mark[^>]*>홍명보<\/mark>&gt;/);
    assert.doesNotMatch(markup, /<홍명보>/);
  });
});
