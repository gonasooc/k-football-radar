import type { Issue, Person } from "./schema";

export const BASE_SEARCH_KEYWORDS = [
  "대한축구협회",
  "KFA",
  "K-축구혁신위원회",
  "축구혁신위",
  "축구협회 회장 선거",
  "축구협회 선거인단",
  "축구협회 정관",
  "축구협회 감사",
  "축구협회 해명",
  "전력강화위원회",
  "대표팀 감독 선임",
  "감독 후보"
] as const;

const ORGANIZATION_KEYWORDS = [
  "대한축구협회",
  "축구협회",
  "KFA",
  "축구혁신위",
  "K-축구혁신위원회"
] as const;

const HIGH_INTEREST_KEYWORDS = [
  "해명",
  "사퇴",
  "감사",
  "선거인단",
  "선거운영위원회",
  "가처분",
  "재심의",
  "정관"
] as const;

const KFA_EXECUTIVES_ISSUE_ID = "kfa-executives";

const KFA_EXECUTIVE_CONTEXT_KEYWORDS = [
  "대한축구협회",
  "대한 축구협회",
  "대한축구협회장",
  "대한 축구협회장",
  "K-축구혁신위원회",
  "축구혁신위",
  "박항서"
] as const;

const KFA_ABBREVIATED_EXECUTIVE_CONTEXT_KEYWORDS = [
  "KFA 임원",
  "KFA 이사회",
  "KFA 집행부",
  "KFA 부회장",
  "KFA 전무",
  "KFA 전무이사",
  "KFA 사무총장"
] as const;

const KFA_EXECUTIVE_PERSON_IDS = new Set([
  "person_chung_mong_gyu",
  "person_lee_yong_soo",
  "person_kim_byung_ji",
  "person_kim_seung_hee",
  "person_hyun_young_min",
  "person_jeon_han_jin",
  "person_lee_im_saeng"
]);

const DANGEROUS_LABELS = new Set([
  "비리",
  "범죄",
  "확정 의혹",
  "부패",
  "유착",
  "문제 인물",
  "블랙리스트",
  "논란"
]);

type ClassifyInput = {
  title: string;
  summary?: string;
  issues: Issue[];
  people: Person[];
  isOfficial?: boolean;
};

type Classification = {
  issueTags: string[];
  personTags: string[];
  matchedKeywords: string[];
  relevanceScore: number;
  labels: string[];
};

function includesKeyword(text: string, keyword: string): boolean {
  return text.toLocaleLowerCase("ko-KR").includes(keyword.toLocaleLowerCase("ko-KR"));
}

function addUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function addSafeLabel(target: string[], value: string): void {
  if (!DANGEROUS_LABELS.has(value)) {
    addUnique(target, value);
  }
}

function hasTrackedKfaExecutivePerson(text: string, people: Person[]): boolean {
  return people.some(
    (person) =>
      person.published &&
      KFA_EXECUTIVE_PERSON_IDS.has(person.id) &&
      person.keywords.some((keyword) => includesKeyword(text, keyword))
  );
}

function shouldAssignKfaExecutiveIssue(text: string, people: Person[]): boolean {
  return (
    KFA_EXECUTIVE_CONTEXT_KEYWORDS.some((keyword) => includesKeyword(text, keyword)) ||
    KFA_ABBREVIATED_EXECUTIVE_CONTEXT_KEYWORDS.some((keyword) =>
      includesKeyword(text, keyword)
    ) ||
    hasTrackedKfaExecutivePerson(text, people)
  );
}

function includesKfaExecutiveIssueKeyword(text: string, keyword: string): boolean {
  if (keyword === "임원") {
    return /(?:대한\s*축구협회|KFA|축구협회)\s*임원|임원\s*(회의|인선|진|명단|구성|사퇴|선임|개편|동향)/u.test(
      text
    );
  }

  if (keyword !== "전무") {
    return includesKeyword(text, keyword);
  }

  return /전무\s*(이사|직|가|는|를|의|와|및|겸|으로|로|에게|인|도|,|\.|\)|$)/u.test(
    text
  );
}

function toSearchQuery(keyword: string): string {
  const normalizedKeyword = keyword.toLocaleLowerCase("ko-KR");
  const hasFootballContext =
    ORGANIZATION_KEYWORDS.some((contextKeyword) =>
      includesKeyword(keyword, contextKeyword)
    ) ||
    normalizedKeyword.includes("축구") ||
    normalizedKeyword.includes("kfa") ||
    keyword.includes("대표팀") ||
    keyword.includes("전력강화위원회");

  if (hasFootballContext) {
    return keyword;
  }

  return `축구협회 ${keyword}`;
}

export function classifyItemText(input: ClassifyInput): Classification {
  const text = `${input.title} ${input.summary ?? ""}`;
  const issueTags: string[] = [];
  const personTags: string[] = [];
  const matchedKeywords: string[] = [];
  const labels: string[] = ["자동 수집"];
  let score = 0;

  if (input.isOfficial) {
    score += 30;
    addSafeLabel(labels, "공식 출처");
  }

  for (const keyword of ORGANIZATION_KEYWORDS) {
    if (includesKeyword(text, keyword)) {
      addUnique(matchedKeywords, keyword);
      score += keyword === "대한축구협회" || keyword === "축구혁신위" ? 20 : 10;
    }
  }

  for (const issue of input.issues) {
    const matchedIssueKeywords = issue.keywords.filter((keyword) => {
      if (issue.id === KFA_EXECUTIVES_ISSUE_ID) {
        return includesKfaExecutiveIssueKeyword(text, keyword);
      }

      return includesKeyword(text, keyword);
    });

    if (matchedIssueKeywords.length === 0) {
      continue;
    }

    if (
      issue.id === KFA_EXECUTIVES_ISSUE_ID &&
      !shouldAssignKfaExecutiveIssue(text, input.people)
    ) {
      continue;
    }

    for (const keyword of matchedIssueKeywords) {
      addUnique(matchedKeywords, keyword);
      score += 10;
    }
    addUnique(issueTags, issue.id);
  }

  for (const person of input.people) {
    if (!person.published) {
      continue;
    }

    let personMatched = false;
    for (const keyword of person.keywords) {
      if (includesKeyword(text, keyword)) {
        personMatched = true;
        addUnique(matchedKeywords, keyword);
        score += 8;
      }
    }
    if (personMatched) {
      addUnique(personTags, person.id);
      addSafeLabel(labels, "인물 언급");
    }
  }

  for (const keyword of HIGH_INTEREST_KEYWORDS) {
    if (includesKeyword(text, keyword)) {
      addUnique(matchedKeywords, keyword);
      score += 5;
      if (keyword === "해명") {
        addSafeLabel(labels, "해명 키워드 포함");
      }
      if (keyword === "감사") {
        addSafeLabel(labels, "감사 키워드 포함");
      }
      if (keyword === "선거인단") {
        addSafeLabel(labels, "선거 키워드 포함");
      }
    }
  }

  return {
    issueTags,
    personTags,
    matchedKeywords,
    relevanceScore: Math.min(100, score),
    labels
  };
}

export function getSearchQueries({
  issues,
  people
}: {
  issues: Issue[];
  people: Person[];
}): string[] {
  const queries: string[] = [];

  for (const keyword of BASE_SEARCH_KEYWORDS) {
    addUnique(queries, keyword);
  }

  for (const issue of [...issues].sort((a, b) => a.priority - b.priority)) {
    for (const keyword of issue.keywords) {
      addUnique(queries, toSearchQuery(keyword));
    }
  }

  for (const person of [...people].sort((a, b) => a.priority - b.priority)) {
    if (!person.published) {
      continue;
    }

    addUnique(queries, `"${person.name}" 대한축구협회`);
    addUnique(queries, `"${person.name}" 축구협회`);
    addUnique(queries, `"${person.name}" 선거`);
    addUnique(queries, `"${person.name}" 해명`);
    addUnique(queries, `"${person.name}" 감사`);
  }

  return queries;
}
