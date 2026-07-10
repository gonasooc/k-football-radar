import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const globalStyles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

describe("Mobile form controls", () => {
  it("keeps form text at 16px to avoid focus zoom", () => {
    assert.match(
      globalStyles,
      /@media \(max-width: 767px\)\s*{\s*input,\s*select,\s*textarea\s*{\s*font-size: 16px;/,
    );
  });

  it("does not disable user-controlled page zoom", () => {
    assert.doesNotMatch(layoutSource, /maximumScale|userScalable/);
  });
});
