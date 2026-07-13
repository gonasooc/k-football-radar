import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const nextConfigSource = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

describe("image optimization", () => {
  it("keeps the header logo on the optimized Next image path", () => {
    assert.doesNotMatch(nextConfigSource, /unoptimized\s*:\s*true/);
    assert.match(layoutSource, /<Image/);
    assert.match(layoutSource, /priority/);
  });
});
