import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveSourceUrl } from "../scripts/collect-official";

describe("resolveSourceUrl", () => {
  it("accepts only http and https links", () => {
    assert.equal(resolveSourceUrl("/notice/1", "https://media.kfa.or.kr/"), "https://media.kfa.or.kr/notice/1");
    assert.equal(resolveSourceUrl("javascript:void(0);", "https://media.kfa.or.kr/"), null);
    assert.equal(resolveSourceUrl("mailto:test@example.com", "https://media.kfa.or.kr/"), null);
  });
});
