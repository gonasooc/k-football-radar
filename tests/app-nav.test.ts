import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const appNavSource = readFileSync(new URL("../components/AppNav.tsx", import.meta.url), "utf8");

describe("AppNav", () => {
  it("adds horizontal padding to the primary mobile nav scroll area", () => {
    const primaryNavClass = appNavSource.match(
      /<nav\s+className="([^"]+)"\s+aria-label="주요 화면"/
    )?.[1];

    assert.ok(primaryNavClass);
    assert.match(primaryNavClass, /(?:^|\s)px-4(?:\s|$)/);
    assert.match(primaryNavClass, /(?:^|\s)sm:px-0(?:\s|$)/);
  });
});
