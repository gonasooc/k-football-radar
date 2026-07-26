import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { classifyItemText } from "../lib/classify";
import type { Issue, Person } from "../lib/schema";
import { getNewsCandidateRelevanceTier } from "../scripts/collect-naver-news";

const issues = JSON.parse(
  readFileSync(new URL("../data/issues.json", import.meta.url), "utf8")
) as Issue[];
const people = JSON.parse(
  readFileSync(new URL("../data/people.json", import.meta.url), "utf8")
) as Person[];

function classifyArticle(article: { title: string; summary: string }) {
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

describe("reviewed news relevance regressions", () => {
  it("rejects an unrelated headline when the summary lead only names KFA", () => {
    const article = {
      title: "아시안게임 선수 명단 발표",
      summary: "KFA는 이날 명단을 발표했다. 자세한 내용은 추후 공개할 예정이다."
    };

    const { classification, tier } = classifyArticle(article);

    assert.deepEqual(classification.issueTags, []);
    assert.deepEqual(classification.personTags, []);
    assert.equal(tier, "reject");
  });

  it("does not classify a KBO personnel photo as a football coach appointment", () => {
    const article = {
      title: "[사진]올스타전 찾은 조계현 전력강화위원장-류지현 감독",
      summary:
        "조계현 KBO 전력강화위원장과 류지현 야구 대표팀 감독이 프로야구 올스타전을 관전하고 있다."
    };

    const { classification, tier } = classifyArticle(article);

    assert.equal(classification.issueTags.includes("coach-appointment"), false);
    assert.equal(tier, "reject");
  });

  it("does not combine foreign-club youth work with a separate past KFA biography", () => {
    const article = {
      title: "이임생, 캄보디아 프로팀 기술이사 취임",
      summary:
        "현지 구단에서 선수 육성과 코칭 시스템 구축을 맡는다. 그는 과거 대한축구협회 기술이사로 일했다."
    };

    const { classification } = classifyArticle(article);

    assert.equal(classification.issueTags.includes("youth-governance"), false);
  });

  it("rejects livestock-cooperative headlines even when election words are present", () => {
    const article = {
      title: "축협 조합장 베트남 출국…선거인단 명단도 확정",
      summary:
        "지역 축산업협동조합 조합장과 축산 농가 관계자들이 해외 연수에 나섰다."
    };

    const { classification, tier } = classifyArticle(article);

    assert.equal(classification.issueTags.includes("electoral-college"), true);
    assert.equal(tier, "reject");
  });

  it("does not let bare English KFA or a non-football electoral college establish context", () => {
    const cases = [
      {
        title: "KFA, 가을 패션 컬렉션 공개",
        summary: "브랜드 경영진은 미국 대통령 선거인단 제도를 캠페인에 활용했다."
      },
      {
        title: "대한체육회장 선거인단 확대",
        summary: "체육회 대의원과 투표권을 늘리는 정관 개정안이 통과됐다."
      }
    ];

    for (const article of cases) {
      const { classification, tier } = classifyArticle(article);

      assert.equal(
        classification.titleMatchedKeywords.includes("KFA"),
        false,
        article.title
      );
      assert.equal(tier, "reject", article.title);
    }
  });

  it("treats gratitude as prose rather than audit or high-interest evidence", () => {
    const article = {
      title: "KFA에 감사한 마음 전한 디자이너",
      summary: "협업 기회를 준 패션 브랜드 KFA에 감사한 마음이라고 밝혔다."
    };

    const { classification, tier } = classifyArticle(article);

    assert.equal(classification.issueTags.includes("mcst-audit"), false);
    assert.equal(classification.matchedKeywords.includes("감사"), false);
    assert.equal(classification.matchedKeywords.includes("KFA"), false);
    assert.equal(tier, "reject");
  });

  it("does not turn a tracked person into Korean coach-appointment evidence abroad", () => {
    const article = {
      title: "이임생, 캄보디아 대표팀 감독 후보로 거론",
      summary: "현지 축구계가 차기 국가대표팀 사령탑 후보군을 검토하고 있다."
    };

    const { classification, tier } = classifyArticle(article);

    assert.equal(classification.personTags.includes("person_lee_im_saeng"), true);
    assert.equal(classification.issueTags.includes("coach-appointment"), false);
    assert.equal(tier, "reject");
  });

  it("does not promote an unrelated summary issue using a football title", () => {
    const article = {
      title: "대한축구협회, 새 엠블럼 공개",
      summary: "미국 대통령 선거인단 제도는 별도 기획 기사에서 소개했다."
    };

    const { classification, tier } = classifyArticle(article);

    assert.deepEqual(classification.titleIssueTags, []);
    assert.equal(classification.summaryIssueTags.includes("electoral-college"), true);
    assert.notEqual(tier, "primary");
  });

  it("keeps exclusions and combinations scoped to their own sentence", () => {
    const article = {
      title:
        "대한축구협회, 대표팀 감독 후보 발표! KBO는 별도 감독 후보를 검토",
      summary: "전력강화위원회가 한국 대표팀의 차기 사령탑 선임 절차를 진행한다."
    };

    const { classification, tier } = classifyArticle(article);

    assert.equal(classification.titleIssueTags.includes("coach-appointment"), true);
    assert.equal(tier, "primary");
  });

  it("keeps national-association criticism near a parliamentary cue", () => {
    const article = {
      title: "축구협회 패라니까 손흥민 부른 국회의원",
      summary: "국회에서 대한축구협회 운영 책임을 따져야 한다는 비판이 나왔다."
    };

    assert.equal(classifyArticle(article).tier, "primary");
  });

  it("keeps contextual KFA governance controls", () => {
    const article = {
      title: "KFA 이사회, 대표팀 감독 선임 절차 논의",
      summary: "전력강화위원회 운영 개선안도 함께 검토했다."
    };

    const { classification, tier } = classifyArticle(article);

    assert.equal(classification.titleMatchedKeywords.includes("KFA"), true);
    assert.equal(classification.titleIssueTags.includes("coach-appointment"), true);
    assert.equal(tier, "primary");
  });

  it("lets a named local association in either field disambiguate a generic headline", () => {
    const localArticles = [
      {
        title: "축구협회 회장 선거 일정 발표",
        summary: "강남구축구협회가 지역 대의원 일정을 공고했다."
      },
      {
        title: "축구협회 정관 개정안 의결",
        summary: "안양시 동안구축구협회가 지역 운영 규정을 바꿨다."
      },
      {
        title: "박지성, 맨유 행사 참석…축구협회 회장 선거 돌입",
        summary: "강남구축구협회가 지역 대의원 일정을 공고했다."
      }
    ];
    const nationalControls = [
      {
        title: "대한축구협회 회장 선거 일정 발표",
        summary: "강남구축구협회도 지역 대의원 일정을 별도로 공고했다."
      },
      {
        title: "축구협회 정관 개정안 의결",
        summary:
          "대한축구협회가 전국 단위 운영 규정을 바꿨고 안양시 동안구축구협회에도 적용된다."
      },
      {
        title: "축구협회장 선거인단 대폭 확대…박지성 \"개혁 후퇴 없을 것\"",
        summary:
          "서강일 전북축구협회장은 박지성 혁신위원장의 개편 방향을 비판했다."
      },
      {
        title:
          "축구협회장 선거인단 대폭 확대…박지성 \"원래로 돌아가진 않을 것\"",
        summary:
          "서강일 전북축구협회장은 박지성 혁신위원장의 개편 방향을 비판했다."
      }
    ];

    for (const article of localArticles) {
      assert.equal(classifyArticle(article).tier, "reject", article.title);
    }
    for (const article of nationalControls) {
      assert.notEqual(classifyArticle(article).tier, "reject", article.title);
    }
  });

  it("keeps a KFA governance interview when the guest's party is named", () => {
    const article = {
      title: "홍명보·정몽규 떠난 한국축구…혁신 성공하려면?",
      summary:
        "국민의힘 진종오 의원과 축구협회 비리 제보와 운영 개혁 방안을 짚었다."
    };

    assert.equal(classifyArticle(article).tier, "primary");
  });

  it("keeps an abbreviated association collapse story with explicit KFA evidence", () => {
    const article = {
      title: "13년 고인물 정치의 종말, 축협은 왜 이제야 무너졌나",
      summary:
        "정몽규 체제의 대한민국 축구협회와 국가대표 감독 밀실 선임, 축협 개혁을 짚었다."
    };

    assert.notEqual(classifyArticle(article).tier, "reject");
  });

  it("keeps direct Korean association election, finance, and English hearing controls", () => {
    const articles = [
      {
        title: "축구협회장 선거 최대 8개월 연장 가능…관련 규정 개정",
        summary: "대한축구협회 회장 선출 기한과 선거제도 개편을 다뤘다."
      },
      {
        title: "National Assembly schedules KFA hearing for July 30",
        summary: "The parliamentary hearing will examine football governance."
      },
      {
        title: "KFA, 나이키 후원금 사용 내역 공개",
        summary: "축구 대표팀 지원과 재정 운영 계획을 함께 공개했다."
      },
      {
        title: "벤투 vs 포옛…차기 한국 국가대표 감독 후보 5인",
        summary: "대한축구협회가 새 사령탑 선임 후보군을 검토한다."
      }
    ];

    for (const article of articles) {
      assert.notEqual(classifyArticle(article).tier, "reject", article.title);
    }
  });

  it("keeps explicit KFA impact in a later summary sentence as secondary", () => {
    const article = {
      title: "대한체육회, 선거인단 41배 늘린다",
      summary:
        "대한축구협회를 비롯한 회원종목단체들도 영향을 받는다. 체육회 정관 변경에 따라 축구협회 선거제도도 같은 수순을 밟는다."
    };

    assert.equal(classifyArticle(article).tier, "secondary");
  });

  it("does not combine unrelated title, field, or sentence evidence into primary", () => {
    const articles = [
      {
        title: "홍명보, 가족과 휴가 근황 공개",
        summary:
          "대한축구협회는 별도로 차기 회장 선거와 선거인단 개편안을 발표했다."
      },
      {
        title: "대한축구협회 새 엠블럼 공개! 미국 대통령 선거인단 제도 확대",
        summary: "두 소식은 서로 관련이 없다."
      },
      {
        title: "최태원, SK 이사회 개편 발표. 대구시축구협회는 새 엠블럼 공개",
        summary: "서로 다른 두 기관의 소식이다."
      },
      {
        title: "박지성, 맨유 행사 참석…대구시축구협회 회장 선거 돌입",
        summary: "지역 대의원들이 새 회장을 선출한다."
      }
    ];

    for (const article of articles) {
      assert.notEqual(classifyArticle(article).tier, "primary", article.title);
    }
  });

  it("rejects foreign national bodies structurally across languages and countries", () => {
    const articles = [
      {
        title: "독일 축구협회장 선거, 새 회장 선출",
        summary: "독일 축구협회가 정관과 선거인단 개편안을 발표했다."
      },
      {
        title: "우간다 축구협회장 선거, 새 회장 선출",
        summary: "현지 선거인단이 투표한다."
      },
      {
        title: "조지아 축구협회장 선거 돌입",
        summary: "새 회장을 선출하기 위한 선거인단 명단이 확정됐다."
      },
      {
        title: "알바니아 대표팀 감독 후보로 홍명보 거론",
        summary: "현지 축구협회가 차기 사령탑을 검토한다."
      },
      {
        title: "이임생, UAE 국가대표 감독 선임 후보",
        summary: "아랍에미리트 축구협회가 후보군을 검토한다."
      },
      {
        title: "이임생, 캄보디아 대표팀 감독 후보…전 대한축구협회 기술이사",
        summary: "현지 대표팀의 차기 사령탑 후보로 거론됐다."
      },
      {
        title: "홍명보, 맨유 감독 후보로 거론",
        summary: "잉글랜드 구단이 차기 사령탑 후보군을 검토한다."
      },
      {
        title: "이임생, 캄보디아 프로팀 감독 후보로 거론",
        summary: "현지 구단이 새 사령탑 후보군을 발표했다."
      }
    ];

    for (const article of articles) {
      assert.equal(classifyArticle(article).tier, "reject", article.title);
    }
  });

  it("rejects local shorthand, livestock, franchise, and political KFA homonyms", () => {
    const articles = [
      {
        title: "충북축구협회 회장 선거, 선거인단 확정",
        summary: "지역 대의원들이 투표한다."
      },
      {
        title: "경기축구협회 정관 개정안 발표",
        summary: "지역 협회 운영 규정을 바꿨다."
      },
      {
        title: "지역 축협 회장 선출…선거인단 명단 확정",
        summary: "농가 대표들이 투표에 참여한다."
      },
      {
        title: "KFA 한국프랜차이즈산업협회 회장 선거 돌입",
        summary: "외식업계 대의원들이 새 회장을 뽑는다."
      },
      {
        title: "국민의힘, 국회 청문회 추진",
        summary: "박지성은 스포츠 홍보대사로 행사에 참석했다."
      }
    ];

    for (const article of articles) {
      assert.equal(classifyArticle(article).tier, "reject", article.title);
    }
  });

  it("caps operational referee coverage below primary", () => {
    const article = {
      title: "축구협회, 현대가 더비 판정 논란에 정심 결론",
      summary: "KFA 심판평가소위원회가 VAR 절차와 경기 규칙을 설명했다."
    };

    assert.notEqual(classifyArticle(article).tier, "primary");
  });

  it("does not mix a foreign electoral sentence with a KFA emblem sentence", () => {
    const article = {
      title: "오늘 날씨 맑음",
      summary:
        "미국 대통령 선거인단 제도를 소개했다. 대한축구협회 새 엠블럼도 공개됐다."
    };

    assert.equal(classifyArticle(article).tier, "reject");
  });

  it("lets a foreign summary disambiguate a generic association headline", () => {
    const article = {
      title: "축구협회 회장 선거 논란?",
      summary:
        "이집트 축구협회가 카이로에서 후보 등록 절차와 대의원 투표 일정을 공고했다."
    };

    assert.equal(classifyArticle(article).tier, "reject");
  });

  it("does not combine comma-separated organizations or sports into one issue", () => {
    const articles = [
      {
        title:
          "대한축구협회 새 엠블럼 공개, 대한체육회 회장 선거 후보 등록",
        summary: "서로 다른 기관의 소식이다."
      },
      {
        title:
          "대한축구협회 새 엠블럼 공개, 이집트 KFA 대표팀 감독 선임 후보 발표",
        summary: "두 기관의 발표를 함께 전한다."
      },
      {
        title:
          "KFA 새 엠블럼 공개, 한국 농구 국가대표팀 감독 선임 후보 발표",
        summary: "대한농구협회가 후보군을 공개했다."
      }
    ];

    for (const article of articles) {
      assert.equal(classifyArticle(article).tier, "reject", article.title);
    }
  });

  it("distinguishes real local bodies from ordinary words ending in place suffixes", () => {
    const localArticles = [
      {
        title: "용인축구협회 회장 선거 후보 등록 시작",
        summary: "지역 대의원들이 새 회장을 선출한다."
      },
      {
        title: "금산군 축구협회 정관 개정",
        summary: "지역 협회 운영 규정을 바꿨다."
      }
    ];

    for (const article of localArticles) {
      assert.equal(classifyArticle(article).tier, "reject", article.title);
    }

    assert.equal(
      classifyArticle({
        title: "반드시 축구협회 개혁해야 한다",
        summary: "국회는 정몽규 체제의 대표팀 운영 책임을 따졌다."
      }).tier,
      "primary"
    );
  });

  it("keeps a local official only when the text directly bridges to national reform", () => {
    assert.equal(
      classifyArticle({
        title: "전북축구협회장, 정몽규 옹호 발언 논란",
        summary: "K-축구혁신위원회가 해당 발언을 반박했다."
      }).tier,
      "primary"
    );
    assert.equal(
      classifyArticle({
        title: "박지성, 맨유 행사 참석…용인축구협회 회장 선거 돌입",
        summary: "지역 대의원들이 투표한다."
      }).tier,
      "reject"
    );
  });

  it("rejects named livestock cooperatives using cross-field cooperative cues", () => {
    const articles = [
      {
        title: "횡성축협 회장 선거 후보 등록",
        summary: "조합원들이 새 조합장을 뽑는다."
      },
      {
        title: "김해축협 정관 개정안 발표",
        summary: "낙농 농가와 젖소 방역 지원 규정을 바꿨다."
      }
    ];

    for (const article of articles) {
      assert.equal(classifyArticle(article).tier, "reject", article.title);
    }
  });

  it("disambiguates non-football KFA identities without vetoing explicit football governance", () => {
    const nonFootball = [
      {
        title: "한국산림협회(KFA), 거버넌스 개혁 착수",
        summary: "산림 정책과 임업 지원 체계를 논의했다."
      },
      {
        title: "한국영화협회 KFA 회장 선거 돌입",
        summary: "영화인 대의원들이 새 회장을 뽑는다."
      }
    ];

    for (const article of nonFootball) {
      assert.equal(classifyArticle(article).tier, "reject", article.title);
    }

    assert.equal(
      classifyArticle({
        title: "KFA, 대표팀 유니폼 패션 논란 속 감사 결과 발표",
        summary: "협회 운영 감사의 후속 조치도 공개했다."
      }).tier,
      "primary"
    );
    assert.equal(
      classifyArticle({
        title: "KFA, 미국 대통령 선거인단 대신 회장 선거 직선제 논의",
        summary: "한국 축구 선거 제도 개편안이다."
      }).tier,
      "primary"
    );
  });

  it("rejects country-qualified KFA while retaining explicit comparison coverage", () => {
    const foreignArticles = [
      {
        title: "이집트: KFA 회장 선거 돌입",
        summary: "현지 대의원들이 투표한다."
      },
      {
        title: "쿠웨이트(KFA) 대표팀 감독 선임 후보 발표",
        summary: "현지 협회가 후보군을 검토한다."
      },
      {
        title: "쿠웨이트 KFA 대표팀 감독 선임 후보 비교",
        summary: "현지 매체가 후보들을 비교했다."
      }
    ];

    for (const article of foreignArticles) {
      assert.equal(classifyArticle(article).tier, "reject", article.title);
    }

    const comparisons = [
      {
        title: "DFB와 KFA, 회장 선거 제도 비교",
        summary: "대한축구협회가 독일 사례를 검토한다."
      },
      {
        title: "대한축구협회, 일본 축구협회 정관 개정 사례 검토",
        summary: "한국 축구 제도 개편에 반영한다."
      }
    ];

    for (const article of comparisons) {
      assert.equal(classifyArticle(article).tier, "primary", article.title);
    }
  });

  it("rejects other national-team sports even when football people or issue words appear", () => {
    const articles = [
      {
        title: "한국 대표팀 감독 후보, 정관 개정 후 선임",
        summary: "대한농구협회가 남자농구 국가대표팀 사령탑을 뽑는다."
      },
      {
        title: "홍명보, 대한민국 하키 국가대표팀 감독 후보",
        summary: "대한하키협회가 차기 사령탑을 공개 채용한다."
      },
      {
        title: "한국 탁구 대표팀 감독 선임 절차 개편",
        summary: "대한탁구협회가 정관을 개정했다."
      },
      {
        title: "축구인 홍명보가 농구 대표팀 감독 선임 후보",
        summary: "대한농구협회가 차기 사령탑 후보군을 검토한다."
      }
    ];

    for (const article of articles) {
      assert.equal(classifyArticle(article).tier, "reject", article.title);
    }

    const { classification } = classifyArticle(articles.at(-1)!);
    assert.equal(classification.issueTags.includes("coach-appointment"), false);
  });

  it("does not use aggregate-only homonym context as relevance or person metadata", () => {
    const article = {
      title: "대한축구협회 회장 선거 제도 개편",
      summary:
        "최태원은 SK 행사에 참석했다. 대구시축구협회는 새 엠블럼을 공개했다."
    };
    const { classification, tier } = classifyArticle(article);

    assert.equal(tier, "primary");
    assert.deepEqual(classification.titlePersonTags, []);
    assert.deepEqual(classification.summaryPersonTags, []);
    assert.equal(classification.personTags.includes("person_choi_tae_won"), false);
  });

  it("keeps a Korean replacement search but rejects a foreign club appointment", () => {
    assert.equal(
      classifyArticle({
        title: "홍명보 후임 후보로 일본 국가대표팀 감독이 거론",
        summary: "대한축구협회가 한국 대표팀 차기 사령탑 후보군을 검토한다."
      }).tier,
      "primary"
    );
    assert.equal(
      classifyArticle({
        title: "홍명보, 맨유 감독 후보로 거론",
        summary: "잉글랜드 구단이 차기 사령탑 후보군을 검토한다."
      }).tier,
      "reject"
    );
  });

  it("scopes semicolon, non-football federation, and independent foreign clauses", () => {
    const articles = [
      {
        title:
          "대한축구협회 새 엠블럼 공개, 한국배구연맹 회장 선거 후보 등록",
        summary: "서로 다른 기관의 소식이다."
      },
      {
        title:
          "KFA 새 엠블럼 공개; 남자 농구 국가대표팀 감독 선임 후보 발표",
        summary: "대한농구협회가 후보군을 공개했다."
      },
      {
        title:
          "대한축구협회 새 엠블럼 공개, 일본 축구협회 정관 개정 사례 검토",
        summary: "서로 다른 두 기관의 발표를 묶어 전한다."
      },
      {
        title: "한국 대표팀 감독 후보, 정관 개정 후 선임",
        summary:
          "새 지도자를 뽑는다. 대한농구협회는 남자농구 대표팀 후보를 검토한다."
      }
    ];

    for (const article of articles) {
      assert.equal(classifyArticle(article).tier, "reject", article.title);
    }
  });

  it("rejects foreign bodies across country gaps and punctuation", () => {
    const titles = [
      "예멘 축구협회 회장 선거",
      "이집트 현지 축구협회 회장 선거",
      "일본도 감독 선임 후보 발표",
      "일본 남자 축구 국가대표팀 감독 선임 후보 발표",
      "일본 여자 축구 대표팀 사령탑 선임",
      "일본의 여자 축구협회 감독 선임 논란",
      "일본 측 축구협회 회장 선거",
      "일본 측은 여자 축구 대표팀 감독 선임 발표",
      "일본 측의 여자축구협회 감독 선임 논란",
      "알바니아 여자축구협회 감독 선임 논란",
      "日 축구협회 회장 선거",
      "中 축구협회 정관 개정",
      "中의 여자 축구협회 감독 선임 논란",
      "中 여자 축구 대표팀 감독 선임 논란",
      "美 축구협회 개혁안 발표",
      "獨 축구협회 회장 선거",
      "佛 축구협회 정관 개정",
      "英 축구협회 개혁안 발표",
      "伊 축구협회 회장 선거",
      "쿠웨이트—KFA 대표팀 감독 선임 후보 발표",
      "쿠웨이트[KFA] 대표팀 감독 선임 후보 발표",
      "이집트 ‘KFA’ 회장 선거"
    ];

    for (const title of titles) {
      const { classification, tier } = classifyArticle({
        title,
        summary: "현지 협회가 일정을 공고했다."
      });
      assert.equal(tier, "reject", title);
      assert.equal(
        classification.issueTags.includes("coach-appointment"),
        false,
        title
      );
    }
  });

  it("requires a country boundary without mistaking 선임이란 for Iran", () => {
    const domestic = classifyArticle({
      title: "대한축구협회 감독 선임이란 감독 철학을 고르는 일",
      summary: "한국 대표팀 차기 사령탑 선임 절차를 점검한다."
    });
    const foreign = classifyArticle({
      title: "이란 감독 선임 후보 발표",
      summary: "현지 축구협회가 후보군을 공개했다."
    });

    assert.equal(domestic.tier, "primary");
    assert.equal(foreign.tier, "reject");

    assert.equal(
      classifyArticle({
        title: "대한축구협회 여자 대표팀 감독 선임 논란",
        summary: "한국 여자 대표팀 차기 사령탑 선임 절차를 점검한다."
      }).tier,
      "primary"
    );
  });

  it("does not let an unrelated farm cue turn a national 축협 hearing into livestock", () => {
    const { tier } = classifyArticle({
      title: "축협 청문회, 감독 선임 절차 따진다",
      summary:
        "농가 지원 예산은 별도 안건으로 논의됐다. 대한축구협회 청문회에서 대표팀 감독 선임 절차를 검증한다."
    });

    assert.equal(tier, "primary");
  });

  it("uses the shared locality and livestock identities without adverb collisions", () => {
    const localOrLivestock = [
      {
        title: "홍성군 축구협회 회장 선거",
        summary: "지역 대의원들이 투표한다."
      },
      {
        title: "화순군축구협회 정관 개정",
        summary: "지역 협회 운영 규정을 바꾼다."
      },
      {
        title: "강남구축구협회 회장 선거 후보 등록",
        summary: "지역 대의원들이 새 회장을 선출한다."
      },
      {
        title: "김해축협 회장 선거 후보 등록",
        summary: "후보 등록 일정을 공고했다."
      },
      {
        title: "영광축협 회장 선거 후보 등록",
        summary: "지역 조합 대의원들이 투표한다."
      },
      {
        title: "전남 영광축협 회장 선거 후보 등록",
        summary: "지역 조합 대의원들이 투표한다."
      },
      {
        title: "축협 회장 사퇴…책임 통감",
        summary: "경영난이 이어진 지역 조합의 경제사업을 점검한다."
      },
      {
        title: "농협중앙회장 직선제 개혁 촉구",
        summary: "농업 협동조합 대의원들이 선거 제도를 논의했다."
      }
    ];

    for (const article of localOrLivestock) {
      assert.equal(classifyArticle(article).tier, "reject", article.title);
    }

    assert.equal(
      classifyArticle({
        title: "반드시 축구협회 직선제 개혁해야 한다",
        summary: "국회가 대한축구협회 선거 제도를 점검했다."
      }).tier,
      "primary"
    );

    assert.notEqual(
      classifyArticle({
        title: "30년 동안 축협 좌지우지한 실세 5명 폭로",
        summary: "대한축구협회의 숨은 권력과 회장 책임을 다룬다."
      }).tier,
      "reject"
    );

    assert.equal(
      classifyArticle({
        title: "김영광 축협 개혁 필요",
        summary:
          "대한축구협회 운영 쇄신과 정몽규 체제 책임을 촉구했다."
      }).tier,
      "primary"
    );

    assert.equal(
      classifyArticle({
        title: "강남구축구협회 소식",
        summary: "축구협회 회장 선거 일정을 발표했다."
      }).tier,
      "reject"
    );

    assert.equal(
      classifyArticle({
        title: "강남구축구협회 소식",
        summary: "대한축구협회가 회장 선거 일정을 발표했다."
      }).tier,
      "secondary"
    );

    assert.equal(
      classifyArticle({
        title: "전북축협회장 막말 논란…대한민국 축구 개혁 목소리",
        summary: "박지성 혁신위원회와 정몽규 체제의 한국 축구 개혁을 다룬다."
      }).tier,
      "secondary"
    );

    assert.notEqual(
      classifyArticle({
        title:
          "부산축협회장에 이어 전북축협회장도 정몽규 두둔…박지성, 이영표가 뭘 아나",
        summary:
          "박지성과 이영표의 혁신위원회 참여를 비판하며 대한축구협회 개혁 논쟁이 이어졌다."
      }).tier,
      "reject"
    );
  });

  it("rejects symmetric Korean and English non-football KFA identities", () => {
    const titles = [
      "Korea Fashion Association (KFA), 회장 선거 일정 확정",
      "Korea Football Coaches Association (KFA), 감독 선임 절차 개편",
      "Korea Football Coaches' Association (KFA), 감독 선임 절차 개편",
      "Korea Football Coaches’ Association (KFA), 감독 선임 절차 개편",
      "Korea Football Coaches Association / KFA 감독 선임 절차 개편",
      "KFA | Korea Football Coaches Association, 감독 선임 절차 개편",
      "한국금융협회[KFA], 거버넌스 개혁 착수",
      "한국금융협회, KFA 회장 선거 제도 개편",
      "KFA(한국금융협회), 회장 선거 제도 개편"
    ];

    for (const title of titles) {
      const { classification, tier } = classifyArticle({
        title,
        summary: "업계 대의원들이 투표한다."
      });
      assert.equal(tier, "reject", title);
      assert.equal(
        classification.titleMatchedKeywords.includes("KFA"),
        false,
        title
      );
    }

    const domestic = classifyArticle({
      title: "Korea Football Association (KFA), 감독 선임 절차 개편",
      summary: "한국 대표팀 차기 사령탑 선임 절차를 점검한다."
    });
    assert.equal(domestic.tier, "primary");
    assert.equal(
      domestic.classification.titleMatchedKeywords.includes("KFA"),
      true
    );

    const crossFieldRebinding = classifyArticle({
      title: "Korea Fashion Association (KFA) announces reform",
      summary: "KFA 회장 선거 일정을 발표했다."
    });
    assert.equal(crossFieldRebinding.tier, "reject");
    assert.equal(
      crossFieldRebinding.classification.summaryMatchedKeywords.includes("KFA"),
      false
    );

    const sameFieldRebinding = classifyArticle({
      title:
        "Korea Fashion Association (KFA). KFA 회장 선거 일정을 발표했다",
      summary: "업계 대의원들이 투표한다."
    });
    assert.equal(sameFieldRebinding.tier, "reject");
    assert.equal(
      sameFieldRebinding.classification.titleMatchedKeywords.includes("KFA"),
      false
    );

    const explicitDomesticOverride = classifyArticle({
      title: "Korea Fashion Association (KFA) announces reform",
      summary:
        "Korea Football Association (KFA) presidential election reform"
    });
    assert.equal(explicitDomesticOverride.tier, "secondary");
    assert.equal(
      explicitDomesticOverride.classification.summaryMatchedKeywords.includes(
        "KFA"
      ),
      true
    );
  });

  it("does not leak person context across unrelated evidence segments", () => {
    const { classification, tier } = classifyArticle({
      title:
        "대한축구협회 회장 선거 제도 개편. 최태원은 SK 행사에 참석했다",
      summary: "대구시축구협회는 새 엠블럼을 공개했다."
    });

    assert.equal(tier, "primary");
    assert.deepEqual(classification.titlePersonTags, []);
    assert.deepEqual(classification.summaryPersonTags, []);
    assert.equal(classification.personTags.includes("person_choi_tae_won"), false);
  });

  it("treats spaced and colloquial thanks as gratitude rather than an audit", () => {
    const articles = [
      {
        title: "한국축구 팬 여러분 감사 드립니다",
        summary: "응원해주신 분들께 감사 드립니다."
      },
      {
        title: "대한축구협회 감사해요",
        summary: "행사 지원에 감사해요."
      }
    ];

    for (const article of articles) {
      const { classification, tier } = classifyArticle(article);
      assert.equal(classification.issueTags.includes("mcst-audit"), false);
      assert.equal(tier, "reject", article.title);
    }
  });

  it("keeps explicit domestic coach processes and structural KFA criticism", () => {
    const articles = [
      {
        title:
          "파울루 벤투 에콰도르행 급부상…KFA 사실무근 후 달라진 7일, 감독 선임 전말",
        summary:
          "대한축구협회의 차기 감독 선임을 짚는다. 에콰도르 축구협회도 벤투와 접촉했다."
      },
      {
        title: "맨유박사 홍명보 감독 선임과정부터 자진사퇴까지의 정리",
        summary: "정몽규와 대한축구협회의 선임 절차를 분석한다."
      },
      {
        title: "손흥민 부진…KFA 인맥 축구가 망친 진짜 이유",
        summary: "KFA의 인맥 중심 운영이 한국 축구에 끼친 영향을 분석한다."
      },
      {
        title: "일본과 비교되는 축구계 카르텔, 빙산의 일각",
        summary:
          "한국 축구 카르텔과 운영 구조를 짚는다. 일본의 축구협회 운영과 비교한다."
      },
      {
        title:
          "전북축구협회장 발언 논란, 대한민국 축구 개혁이 필요한 이유",
        summary: "박지성 혁신위원회와 정몽규 체제 개혁을 다룬다."
      }
    ];

    for (const article of articles) {
      assert.notEqual(classifyArticle(article).tier, "reject", article.title);
    }
  });
});
