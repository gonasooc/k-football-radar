import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  CONTACT_EMAIL,
  CONTACT_EMAIL_HREF,
  CONTACT_EMAIL_SUBJECT
} from "../lib/contact";

const componentSource = readFileSync(
  new URL("../components/EditorialContact.tsx", import.meta.url),
  "utf8"
);
const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

describe("Editorial contact", () => {
  it("keeps the editable email address and encoded subject in one config module", () => {
    assert.equal(CONTACT_EMAIL, "feedback@k-football-radar.app");
    assert.equal(CONTACT_EMAIL_SUBJECT, "[Korea Football Radar] 제보·정정·개선 의견");
    assert.equal(
      CONTACT_EMAIL_HREF,
      `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(CONTACT_EMAIL_SUBJECT)}`
    );
  });

  it("adds a semantic, accessible contact point to the global layout", () => {
    assert.match(componentSource, /<footer/);
    assert.match(componentSource, /aria-labelledby="editorial-contact-heading"/);
    assert.match(componentSource, /min-h-11/);
    assert.match(componentSource, /제보·문의/);
    assert.match(componentSource, /누락된 소식이나 잘못된 정보를 알려주세요/);
    assert.doesNotMatch(componentSource, /편집 데스크/);
    assert.match(layoutSource, /<EditorialContact \/>/);
    assert.match(layoutSource, /flex min-h-screen flex-col/);
  });

  it("leaves room for the fixed mobile navigation", () => {
    assert.match(componentSource, /safe-area-inset-bottom/);
    assert.match(componentSource, /sm:pb-0/);
  });
});
