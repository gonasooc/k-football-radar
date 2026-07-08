import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { stripHtml, stripInlineHtml } from "../lib/normalize";

describe("HTML normalization", () => {
  it("keeps inline title text together when removing API highlight tags", () => {
    assert.equal(stripInlineHtml("<b>축구</b>부, 지역리그 우승"), "축구부, 지역리그 우승");
    assert.equal(stripInlineHtml("달서구청 여성 <b>축구</b>단"), "달서구청 여성 축구단");
  });

  it("keeps block-style text readable for summaries", () => {
    assert.equal(stripHtml("대한축구협회<b>감사</b> 결과"), "대한축구협회 감사 결과");
  });
});
