import { readFileSync } from "node:fs";
import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";

import { classifyItemText } from "../lib/classify";
import type { Issue, Person } from "../lib/schema";
import {
  collectNaverNewsRun,
  getNewsCandidateRelevanceTier,
  shouldKeepNewsCandidate
} from "../scripts/collect-naver-news";

const issues = JSON.parse(
  readFileSync(new URL("../data/issues.json", import.meta.url), "utf8")
) as Issue[];
const people = JSON.parse(
  readFileSync(new URL("../data/people.json", import.meta.url), "utf8")
) as Person[];

const falsePositiveArticles = [
  {
    title: "금산삼계탕축제 7만 2000명 발길…여름 대표 축제 입지 다져",
    summary:
      "금산군체육회와 금산군 축구협회 가 개최한 '2026 금산삼계탕축제배 유소년 축구 대회'에는 전국 30개 팀, 선수와 학부모·관계자 등 600여 명이 참가했다. 참가 선수단은 경기 일정과 함께 축제장을 찾아 삼계탕을 맛보고..."
  },
  {
    title: "경찰, 배재고 야구부 불송치 전망…\"광주일고 진정 취소 의사\"",
    summary:
      "박 청장은 \"신세계 그룹으로부터 감사 자료와 포렌식 자료를 받아서 분석하고 있다\"며 \"관련자 조사도... 경찰은 홍명보 전 국가대표 감독 선임 논란에 대한 대한축구협회 수사에 대해 속도를 내겠다는 입장이다. 박..."
  }
] as const;

const primaryControlArticles = [
  {
    title: "대한축구협회, 유소년 지도자 제도 개편안 발표",
    summary:
      "유소년 육성 시스템과 지도자 자격·교육 체계를 개편하고 거버넌스 개선을 추진한다."
  },
  {
    title: "경찰, 홍명보 감독 선임 의혹 수사…대한축구협회 관계자 조사",
    summary:
      "대표팀 감독 선임 절차와 전력강화위원회 운영을 들여다보고 있다."
  }
] as const;

type Article = (typeof falsePositiveArticles)[number] | (typeof primaryControlArticles)[number];

function classifyArticle(article: Article | { title: string; summary: string }) {
  const classification = classifyItemText({
    ...article,
    issues,
    people,
    isOfficial: false
  });

  return {
    classification,
    tier: getNewsCandidateRelevanceTier({ ...article, classification })
  };
}

describe("news title relevance regressions", () => {
  it("rejects the two real false positives even when their snippets contain tracked terms", () => {
    for (const article of falsePositiveArticles) {
      const { classification, tier } = classifyArticle(article);

      assert.equal(tier, "reject", article.title);
      assert.equal(
        shouldKeepNewsCandidate({ ...article, classification }),
        false,
        article.title
      );
    }
  });

  it("requires system or policy context before assigning the youth governance issue", () => {
    const festival = classifyArticle(falsePositiveArticles[0]).classification;
    const systemReform = classifyArticle(primaryControlArticles[0]).classification;

    assert.equal(festival.issueTags.includes("youth-governance"), false);
    assert.equal(systemReform.issueTags.includes("youth-governance"), true);
  });

  it("keeps explicit youth reform and Hong appointment investigations as primary", () => {
    for (const article of primaryControlArticles) {
      const { classification, tier } = classifyArticle(article);

      assert.equal(tier, "primary", article.title);
      assert.equal(
        shouldKeepNewsCandidate({ ...article, classification }),
        true,
        article.title
      );
    }
  });

  it("uses secondary for an ambiguous title with strong summary evidence", () => {
    const article = {
      title: "경찰, 관련 의혹 수사 속도 낸다",
      summary:
        "홍명보 국가대표 감독 선임 과정과 대한축구협회 관계자들을 조사하고 있다."
    };

    assert.equal(classifyArticle(article).tier, "secondary");
  });

  it("keeps common governance headline aliases without reopening summary-only noise", () => {
    const cases = [
      {
        article: {
          title: "문체부, 축구협회 특별감사 착수…운영 전반 조사",
          summary: "조사 결과를 공개하고 제도 개선과 후속 조치를 추진한다."
        },
        expectedTier: "primary"
      },
      {
        article: {
          title: "축구계 개혁 논의하는 K-혁신위…현장 목소리 보강",
          summary: "대한축구협회와 프로축구연맹이 혁신위원회 개선안을 논의했다."
        },
        expectedTier: "primary"
      },
      {
        article: {
          title: "벤투 감독 복귀하나…축협에 한국 사령탑 도전 의사",
          summary: "대한축구협회가 차기 대표팀 감독 후보군을 검토하고 있다."
        },
        expectedTier: "primary"
      },
      {
        article: {
          title: "손흥민·황희찬 청문회 참고인 신청 철회",
          summary: "축구협회 운영과 대표팀 감독 선임 과정을 다룰 국회 청문회다."
        },
        expectedTier: "secondary"
      }
    ] as const;

    for (const { article, expectedTier } of cases) {
      assert.equal(classifyArticle(article).tier, expectedTier, article.title);
    }
  });

  it("rejects tracked-person headlines that are only parody or thanks", () => {
    const cases = [
      {
        title: "젠슨황·홍명보까지…의정부고 졸업사진 또 터졌다",
        summary: "학생이 홍명보 전 대표팀 감독을 패러디해 눈길을 끌었다."
      },
      {
        title: "홍명보 감독님 감사합니다…대표팀 코치가 전한 인사",
        summary: "대한축구협회와 코치진에게 감사 인사를 전하고 싶다고 밝혔다."
      }
    ];

    for (const article of cases) {
      assert.equal(classifyArticle(article).tier, "reject", article.title);
    }
  });
});

describe("collectNaverNewsRun title relevance integration", () => {
  const originalEnv = {
    NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID,
    NAVER_CLIENT_SECRET: process.env.NAVER_CLIENT_SECRET,
    NAVER_QUERY_DELAY_MS: process.env.NAVER_QUERY_DELAY_MS
  };

  afterEach(() => {
    mock.restoreAll();
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("drops off-topic titles and collects only the explicit primary controls", async () => {
    const articles = [...falsePositiveArticles, ...primaryControlArticles];
    const now = new Date().toUTCString();

    mock.method(globalThis, "fetch", async (): Promise<Response> => {
      return new Response(
        JSON.stringify({
          items: articles.map((article, index) => ({
            title: article.title,
            originallink: `https://news.example.com/relevance-regression-${index}`,
            link: `https://n.news.naver.com/mnews/article/001/${index}`,
            description: article.summary,
            pubDate: now
          }))
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    process.env.NAVER_CLIENT_ID = "test-client-id";
    process.env.NAVER_CLIENT_SECRET = "test-client-secret";
    process.env.NAVER_QUERY_DELAY_MS = "0";

    const result = await collectNaverNewsRun({ issues, people });

    assert.deepEqual(
      result.items.map((item) => item.title).sort(),
      primaryControlArticles.map((article) => article.title).sort()
    );
    assert.ok(result.items.every((item) => item.relevanceTier !== "secondary"));
  });
});
