import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  extractOfficialCandidates,
  parseOfficialDate,
  resolveKfaMediaUrl,
  resolveSourceUrl,
  resolveSportsCouncilUrl,
  shouldKeepOfficialCandidate
} from "../scripts/collect-official";
import type { Source } from "../lib/schema";

const kfaSource: Source = {
  id: "kfa_media",
  name: "KFA 미디어채널",
  type: "official",
  url: "https://media.kfa.or.kr/",
  enabled: true
};

const mcstSource: Source = {
  id: "mcst_press",
  name: "문화체육관광부 보도자료",
  type: "official",
  url: "https://www.mcst.go.kr/site/s_notice/press/pressList.jsp",
  enabled: true
};

const sportsCouncilSource: Source = {
  id: "sports_council",
  name: "대한체육회 보도자료",
  type: "official",
  url: "http://www.sports.or.kr/sports/bbs/BMSR00001/list.do?menuNo=200024",
  enabled: true
};

describe("resolveSourceUrl", () => {
  it("accepts only http and https links", () => {
    assert.equal(resolveSourceUrl("/notice/1", "https://media.kfa.or.kr/"), "https://media.kfa.or.kr/notice/1");
    assert.equal(resolveSourceUrl("javascript:void(0);", "https://media.kfa.or.kr/"), null);
    assert.equal(resolveSourceUrl("mailto:test@example.com", "https://media.kfa.or.kr/"), null);
  });

  it("resolves official site javascript handlers to stable detail URLs", () => {
    assert.equal(
      resolveKfaMediaUrl(
        "view_contents('5102','a75967294d386d51454b69d160c77e3b');",
        kfaSource.url
      ),
      "https://media.kfa.or.kr/bbs/bbs.php?act=bbs_view_layer&idx=5102&con=a75967294d386d51454b69d160c77e3b"
    );
    assert.equal(
      resolveSportsCouncilUrl("javascript:bbsView('72669');", sportsCouncilSource.url),
      "http://www.sports.or.kr/sports/bbs/BMSR00001/view.do?boardId=72669&menuNo=200024"
    );
  });
});

describe("extractOfficialCandidates", () => {
  const fallbackPublishedAt = "2026-07-09T00:00:00.000Z";

  it("extracts KFA media candidates from onclick-only cards", () => {
    const candidates = extractOfficialCandidates(
      `<a href="javascript:void(0);" onclick="view_contents('5102','abc123');">
        <div class="caption">
          <span class="date">2026.07.06 (월)</span>
          <p>[보도자료] 정몽규 대한축구협회장 사임서 제출</p>
        </div>
      </a>`,
      kfaSource,
      fallbackPublishedAt
    );

    assert.deepEqual(candidates, [
      {
        title: "[보도자료] 정몽규 대한축구협회장 사임서 제출",
        url: "https://media.kfa.or.kr/bbs/bbs.php?act=bbs_view_layer&idx=5102&con=abc123",
        publishedAt: new Date("2026-07-06T00:00:00+09:00").toISOString()
      }
    ]);
  });

  it("extracts MCST press rows with title URLs and publication dates", () => {
    const candidates = extractOfficialCandidates(
      `<table><tr>
        <td aria-label="제목" class="tit_wrap">
          <a href="pressView.jsp?pSeq=22563" title="‘케이-축구 혁신위원회’ 출범, 한국 축구의 미래를 그린다">
            <p class="tit">‘케이-축구 혁신위원회’ 출범, 한국 축구의 미래를 그린다</p>
          </a>
        </td>
        <td aria-label="게시일">2026.07.03.</td>
      </tr></table>`,
      mcstSource,
      fallbackPublishedAt
    );

    assert.deepEqual(candidates, [
      {
        title: "‘케이-축구 혁신위원회’ 출범, 한국 축구의 미래를 그린다",
        url: "https://www.mcst.go.kr/site/s_notice/press/pressView.jsp?pSeq=22563",
        publishedAt: new Date("2026-07-03T00:00:00+09:00").toISOString()
      }
    ]);
  });

  it("extracts sports council board rows from bbsView handlers", () => {
    const candidates = extractOfficialCandidates(
      `<table><tr>
        <td class="tit">
          <a href="javascript:bbsView('72669');">대한체육회, 2026 청소년대표·꿈나무선수 전담지도자 간담회 개최</a>
          <ul><li>등록일 : 2026-06-30</li></ul>
        </td>
      </tr></table>`,
      sportsCouncilSource,
      fallbackPublishedAt
    );

    assert.deepEqual(candidates, [
      {
        title: "대한체육회, 2026 청소년대표·꿈나무선수 전담지도자 간담회 개최",
        url: "http://www.sports.or.kr/sports/bbs/BMSR00001/view.do?boardId=72669&menuNo=200024",
        publishedAt: new Date("2026-06-30T00:00:00+09:00").toISOString()
      }
    ]);
  });

  it("parses supported official date formats with a fallback", () => {
    assert.equal(
      parseOfficialDate("2026.07.06 (월)", fallbackPublishedAt),
      new Date("2026-07-06T00:00:00+09:00").toISOString()
    );
    assert.equal(
      parseOfficialDate("2026-07-06 10:52", fallbackPublishedAt),
      new Date("2026-07-06T10:52:00+09:00").toISOString()
    );
    assert.equal(parseOfficialDate("날짜 없음", fallbackPublishedAt), fallbackPublishedAt);
  });
});

describe("shouldKeepOfficialCandidate", () => {
  it("rejects organization-only navigation links without issue or person tags", () => {
    assert.equal(
      shouldKeepOfficialCandidate({
        classification: {
          issueTags: [],
          personTags: [],
          matchedKeywords: ["KFA"],
          relevanceScore: 40,
          labels: ["공식 출처"]
        },
        sourceId: "kfa_media"
      }),
      false
    );
    assert.equal(
      shouldKeepOfficialCandidate({
        classification: {
          issueTags: ["election"],
          personTags: [],
          matchedKeywords: ["대한축구협회장"],
          relevanceScore: 70,
          labels: ["공식 출처"]
        },
        sourceId: "sports_council"
      }),
      true
    );
    assert.equal(
      shouldKeepOfficialCandidate({
        classification: {
          issueTags: ["innovation-committee"],
          personTags: [],
          matchedKeywords: ["혁신위원회", "축구 혁신"],
          relevanceScore: 50,
          labels: ["공식 출처"]
        },
        sourceId: "mcst_press"
      }),
      true
    );
    assert.equal(
      shouldKeepOfficialCandidate({
        classification: {
          issueTags: ["youth-governance"],
          personTags: [],
          matchedKeywords: ["유소년"],
          relevanceScore: 45,
          labels: ["공식 출처"]
        },
        sourceId: "sports_council"
      }),
      false
    );
  });
});
