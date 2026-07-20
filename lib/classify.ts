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

const STRONG_ORGANIZATION_KEYWORDS = [
  "대한축구협회",
  "대한 축구협회",
  "KFA",
  "K-축구혁신위원회",
  "축구혁신위",
  "한국프로축구연맹",
  "프로축구연맹"
] as const;

const GENERIC_ORGANIZATION_KEYWORDS = ["축구협회", "축구협회장"] as const;

const ORGANIZATION_KEYWORDS = [
  ...STRONG_ORGANIZATION_KEYWORDS,
  ...GENERIC_ORGANIZATION_KEYWORDS
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
const MCST_AUDIT_ISSUE_ID = "mcst-audit";
const COACH_APPOINTMENT_ISSUE_ID = "coach-appointment";

const MCST_AUDIT_CONTEXT_KEYWORDS = [
  "문체부",
  "문화체육관광부",
  "대한축구협회",
  "대한 축구협회",
  "KFA",
  "축구협회 감사",
  "축구협회 특정 감사",
  "대표팀 감독 선임",
  "감독 선임",
  "전력강화위원회",
  "한국 축구",
  "한국축구",
  "대한민국 축구"
] as const;

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

const DOMESTIC_FOOTBALL_CONTEXT_KEYWORDS = [
  "대한축구협회",
  "대한 축구협회",
  "KFA",
  "축협",
  "한국 축구",
  "한국축구",
  "대한민국 축구",
  "한국프로축구연맹",
  "프로축구연맹",
  "K리그",
  "전력강화위원회",
  "전력강화위원"
] as const;

const LOCAL_ASSOCIATION_PATTERN = /[가-힣]{2,}(?:특별시|광역시|특별자치도|도|시|군|구)\s*축구협회/u;
const GOVERNANCE_SIGNAL_PATTERN =
  /(?:청문회|문체부|문화체육관광부|감독\s*선임|선임\s*절차|전력강화위원|회장\s*선거|선거인단|직선제|간선제|정관|징계|소송|가처분|이사회|집행부|제도\s*(?:개편|개선)|거버넌스|혁신|개혁|쇄신|사퇴|퇴진|고발|배임|수사|조사|부조리|비위|위법|파헤)/u;

type ClassifyInput = {
  title: string;
  summary?: string;
  /**
   * Publisher-supplied keywords (YouTube video tags). Scored alongside the
   * summary because videos often carry the only governance signal there:
   * broadcasters routinely upload with a bare description such as a couple of
   * hashtags while listing the actual subjects as tags.
   */
  tags?: string[];
  issues: Issue[];
  people: Person[];
  isOfficial?: boolean;
};

export function joinSummaryAndTags(
  summary: string | undefined,
  tags: readonly string[] | undefined
): string {
  return [summary ?? "", ...(tags ?? [])]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(" ");
}

type FieldClassification = {
  issueTags: string[];
  personTags: string[];
  matchedKeywords: string[];
  organizationKeywords: string[];
  highInterestKeywords: string[];
};

export type Classification = {
  issueTags: string[];
  personTags: string[];
  matchedKeywords: string[];
  relevanceScore: number;
  labels: string[];
  titleIssueTags: string[];
  summaryIssueTags: string[];
  titlePersonTags: string[];
  summaryPersonTags: string[];
  titleMatchedKeywords: string[];
  summaryMatchedKeywords: string[];
  titleRelevanceScore: number;
  summaryRelevanceScore: number;
};

function includesKeyword(text: string, keyword: string): boolean {
  return text.toLocaleLowerCase("ko-KR").includes(keyword.toLocaleLowerCase("ko-KR"));
}

function addUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function addSafeLabel(target: string[], value: string): void {
  if (!DANGEROUS_LABELS.has(value)) {
    addUnique(target, value);
  }
}

export function getPersonKeywordMatches(
  person: Person,
  fieldText: string,
  fullText = fieldText
): string[] {
  const matches = person.keywords.filter((keyword) =>
    includesKeyword(fieldText, keyword)
  );
  if (matches.length === 0) {
    return [];
  }
  const contextKeywords = person.contextKeywords ?? [];
  if (
    contextKeywords.length > 0 &&
    !contextKeywords.some((keyword) => includesKeyword(fullText, keyword))
  ) {
    return [];
  }
  return matches;
}

function hasTrackedKfaExecutivePerson(text: string, people: Person[]): boolean {
  return people.some(
    (person) =>
      person.published &&
      KFA_EXECUTIVE_PERSON_IDS.has(person.id) &&
      getPersonKeywordMatches(person, text).length > 0
  );
}

function hasTrackedPersonWithGovernanceContext(text: string, people: Person[]): boolean {
  return (
    GOVERNANCE_SIGNAL_PATTERN.test(text) &&
    people.some(
      (person) =>
        person.published && getPersonKeywordMatches(person, text).length > 0
    )
  );
}

function hasDomesticFootballContext(text: string): boolean {
  return DOMESTIC_FOOTBALL_CONTEXT_KEYWORDS.some((keyword) =>
    includesKeyword(text, keyword)
  );
}

function shouldCountGenericAssociation(text: string, people: Person[]): boolean {
  if (hasDomesticFootballContext(text)) {
    return true;
  }

  if (LOCAL_ASSOCIATION_PATTERN.test(text)) {
    return false;
  }

  return (
    /(?:축구협회|축구협회장).{0,35}(?:회장\s*선거|선거인단|직선제|간선제|정관|청문회|감독\s*선임|전력강화위원|징계|가처분|이사회|집행부|고발|배임|수사)/u.test(
      text
    ) ||
    /(?:회장\s*선거|선거인단|직선제|간선제|정관|청문회|감독\s*선임|전력강화위원|징계|가처분|이사회|집행부|고발|배임|수사).{0,35}(?:축구협회|축구협회장)/u.test(
      text
    ) ||
    hasTrackedPersonWithGovernanceContext(text, people)
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

function isMcstAuditIssue(issue: Issue): boolean {
  return (
    issue.id === MCST_AUDIT_ISSUE_ID ||
    issue.keywords.some(
      (keyword) => keyword === "문체부 감사" || keyword === "문화체육관광부 감사"
    )
  );
}

function hasMcstAuditContext(text: string): boolean {
  return MCST_AUDIT_CONTEXT_KEYWORDS.some((keyword) => includesKeyword(text, keyword));
}

function includesMcstAuditIssueKeyword(
  fieldText: string,
  fullText: string,
  keyword: string
): boolean {
  if (!includesKeyword(fieldText, keyword)) {
    return false;
  }

  if (keyword === "감사") {
    const hasSemanticAuditTerm =
      /감사(?!\s*(?:합니다|드립니다|인사|패|를?\s*전|의\s*뜻|인사를))/u.test(
        fieldText
      );
    const hasKfaAuditRelation =
      /(?:대한\s*축구협회|KFA|한국\s*축구|한국축구).{0,50}감사(?!\s*(?:합니다|드립니다|인사|패|를?\s*전|의\s*뜻|인사를))/u.test(
        fullText
      ) ||
      /감사(?!\s*(?:합니다|드립니다|인사|패|를?\s*전|의\s*뜻|인사를)).{0,50}(?:대한\s*축구협회|KFA|한국\s*축구|한국축구)/u.test(
        fullText
      ) ||
      /(?:문체부|문화체육관광부).{0,30}감사|감사.{0,30}(?:문체부|문화체육관광부)/u.test(
        fullText
      );
    return hasSemanticAuditTerm && hasKfaAuditRelation;
  }

  if (keyword === "조사 결과") {
    return hasMcstAuditContext(fullText);
  }

  return true;
}

function getIssueEvidenceKeywords(issue: Issue): string[] {
  return unique([
    ...issue.keywords,
    ...(issue.requiredKeywordGroups?.flat() ?? [])
  ]);
}

function passesIssueCombinationRules(
  issue: Issue,
  fieldText: string,
  location: "title" | "summary",
  people: Person[]
): boolean {
  if (
    issue.excludedKeywords?.some((keyword) => includesKeyword(fieldText, keyword))
  ) {
    return false;
  }

  if (!issue.requiredKeywordGroups && !issue.contextKeywords) {
    return true;
  }

  const evidenceSegments =
    location === "title"
      ? [fieldText]
      : fieldText
          .split(/(?:\.{3}|…+|[.!?](?:\s|$))/u)
          .map((segment) => segment.trim())
          .filter(Boolean);

  return evidenceSegments.some((segment) => {
    if (
      issue.requiredKeywordGroups &&
      !issue.requiredKeywordGroups.every((group) =>
        group.some((keyword) => includesKeyword(segment, keyword))
      )
    ) {
      return false;
    }

    if (
      issue.contextKeywords &&
      !issue.contextKeywords.some((keyword) => includesKeyword(segment, keyword)) &&
      !(
        issue.id === COACH_APPOINTMENT_ISSUE_ID &&
        people.some(
          (person) =>
            person.published &&
            person.keywords.some((keyword) => includesKeyword(segment, keyword))
        )
      )
    ) {
      return false;
    }

    return true;
  });
}

function getIssueMatches({
  fieldText,
  fullText,
  location,
  issue,
  people
}: {
  fieldText: string;
  fullText: string;
  location: "title" | "summary";
  issue: Issue;
  people: Person[];
}): string[] {
  if (!passesIssueCombinationRules(issue, fieldText, location, people)) {
    return [];
  }

  if (
    issue.id === KFA_EXECUTIVES_ISSUE_ID &&
    !shouldAssignKfaExecutiveIssue(fullText, people)
  ) {
    return [];
  }

  return getIssueEvidenceKeywords(issue).filter((keyword) => {
    if (issue.id === KFA_EXECUTIVES_ISSUE_ID) {
      return includesKfaExecutiveIssueKeyword(fieldText, keyword);
    }

    if (isMcstAuditIssue(issue)) {
      return includesMcstAuditIssueKeyword(fieldText, fullText, keyword);
    }

    if (
      (keyword === "축구협회장" || keyword === "대한축구협회장") &&
      !shouldCountGenericAssociation(fullText, people)
    ) {
      return false;
    }

    return includesKeyword(fieldText, keyword);
  });
}

function getOrganizationMatches(
  fieldText: string,
  fullText: string,
  people: Person[]
): string[] {
  const matches = ORGANIZATION_KEYWORDS.filter((keyword) => {
    if (!includesKeyword(fieldText, keyword)) {
      return false;
    }

    if ((GENERIC_ORGANIZATION_KEYWORDS as readonly string[]).includes(keyword)) {
      return shouldCountGenericAssociation(fullText, people);
    }

    return true;
  });

  return matches.filter(
    (keyword) =>
      !matches.some(
        (otherKeyword) =>
          otherKeyword.length > keyword.length &&
          otherKeyword.toLocaleLowerCase("ko-KR").includes(
            keyword.toLocaleLowerCase("ko-KR")
          )
      )
  );
}

function classifyField({
  fieldText,
  fullText,
  location,
  issues,
  people
}: {
  fieldText: string;
  fullText: string;
  location: "title" | "summary";
  issues: Issue[];
  people: Person[];
}): FieldClassification {
  const issueTags: string[] = [];
  const personTags: string[] = [];
  const matchedKeywords = getOrganizationMatches(fieldText, fullText, people);
  const organizationKeywords = [...matchedKeywords];
  const highInterestKeywords: string[] = [];

  for (const issue of issues) {
    const issueMatches = getIssueMatches({
      fieldText,
      fullText,
      location,
      issue,
      people
    });
    if (issueMatches.length === 0) {
      continue;
    }

    addUnique(issueTags, issue.id);
    for (const keyword of issueMatches) {
      addUnique(matchedKeywords, keyword);
    }
  }

  for (const person of people) {
    if (!person.published) {
      continue;
    }

    const personMatches = getPersonKeywordMatches(person, fieldText, fullText);
    if (personMatches.length === 0) {
      continue;
    }

    addUnique(personTags, person.id);
    for (const keyword of personMatches) {
      addUnique(matchedKeywords, keyword);
    }
  }

  for (const keyword of HIGH_INTEREST_KEYWORDS) {
    if (!includesKeyword(fieldText, keyword)) {
      continue;
    }
    addUnique(highInterestKeywords, keyword);
    addUnique(matchedKeywords, keyword);
  }

  return {
    issueTags,
    personTags,
    matchedKeywords,
    organizationKeywords,
    highInterestKeywords
  };
}

function getFieldScore(
  classification: FieldClassification,
  location: "title" | "summary"
): number {
  const hasStrongOrganization = classification.organizationKeywords.some((keyword) =>
    (STRONG_ORGANIZATION_KEYWORDS as readonly string[]).includes(keyword)
  );
  const organizationScore =
    classification.organizationKeywords.length === 0
      ? 0
      : location === "title"
        ? hasStrongOrganization
          ? 20
          : 10
        : hasStrongOrganization
          ? 6
          : 3;
  const issueScore =
    classification.issueTags.length * (location === "title" ? 10 : 4);
  const personScore =
    classification.personTags.length * (location === "title" ? 8 : 3);
  const highInterestScore =
    Math.min(2, classification.highInterestKeywords.length) *
    (location === "title" ? 5 : 2);

  return organizationScore + issueScore + personScore + highInterestScore;
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
  const title = input.title;
  const summary = joinSummaryAndTags(input.summary, input.tags);
  const fullText = `${title} ${summary}`.trim();
  const titleClassification = classifyField({
    fieldText: title,
    fullText,
    location: "title",
    issues: input.issues,
    people: input.people
  });
  const summaryClassification = classifyField({
    fieldText: summary,
    fullText,
    location: "summary",
    issues: input.issues,
    people: input.people
  });
  const titleRelevanceScore = getFieldScore(titleClassification, "title");
  const summaryRelevanceScore = getFieldScore(summaryClassification, "summary");
  const issueTags = unique([
    ...titleClassification.issueTags,
    ...summaryClassification.issueTags
  ]);
  const personTags = unique([
    ...titleClassification.personTags,
    ...summaryClassification.personTags
  ]);
  const matchedKeywords = unique([
    ...titleClassification.matchedKeywords,
    ...summaryClassification.matchedKeywords
  ]);
  const labels: string[] = [];

  if (input.isOfficial) {
    addSafeLabel(labels, "공식 출처");
  }
  if (personTags.length > 0) {
    addSafeLabel(labels, "인물 언급");
  }
  if (matchedKeywords.includes("해명")) {
    addSafeLabel(labels, "해명 키워드 포함");
  }
  if (matchedKeywords.includes("감사")) {
    addSafeLabel(labels, "감사 키워드 포함");
  }
  if (matchedKeywords.includes("선거인단")) {
    addSafeLabel(labels, "선거 키워드 포함");
  }

  return {
    issueTags,
    personTags,
    matchedKeywords,
    relevanceScore: Math.min(
      100,
      (input.isOfficial ? 30 : 0) + titleRelevanceScore + summaryRelevanceScore
    ),
    labels,
    titleIssueTags: titleClassification.issueTags,
    summaryIssueTags: summaryClassification.issueTags,
    titlePersonTags: titleClassification.personTags,
    summaryPersonTags: summaryClassification.personTags,
    titleMatchedKeywords: titleClassification.matchedKeywords,
    summaryMatchedKeywords: summaryClassification.matchedKeywords,
    titleRelevanceScore,
    summaryRelevanceScore
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
    for (const keyword of issue.searchQueries ?? issue.keywords) {
      addUnique(queries, toSearchQuery(keyword));
    }
  }

  for (const person of [...people].sort((a, b) => a.priority - b.priority)) {
    if (!person.published) {
      continue;
    }

    // An explicit list replaces the default set, so a person can be tracked for
    // classification without spending five slots of a capped query budget.
    if (person.searchQueries) {
      for (const query of person.searchQueries) {
        addUnique(queries, query);
      }
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
