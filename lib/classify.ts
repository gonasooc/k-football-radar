import type { Issue, Person } from "./schema";
import {
  hasLocalFootballAssociationContext,
  hasNamedLocalLivestockCooperativeContext
} from "./korean-localities";

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
const ABBREVIATED_ORGANIZATION_KEYWORDS = ["축협"] as const;

const ORGANIZATION_KEYWORDS = [
  ...STRONG_ORGANIZATION_KEYWORDS,
  ...GENERIC_ORGANIZATION_KEYWORDS,
  ...ABBREVIATED_ORGANIZATION_KEYWORDS
] as const;

const HIGH_INTEREST_KEYWORDS = [
  "해명",
  "사퇴",
  "감사",
  "청문회",
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
  "한국 축구",
  "한국축구",
  "대한민국 축구",
  "한국 대표팀",
  "한국 국가대표",
  "대한민국 대표팀",
  "한국프로축구연맹",
  "프로축구연맹",
  "K리그",
  "전력강화위원회",
  "전력강화위원"
] as const;

const GOVERNANCE_SIGNAL_PATTERN =
  /(?:국회|국회의원|문체위|청문회|문체부|문화체육관광부|감독\s*선임|선임\s*절차|전력강화위원|회장\s*선거|선출|선거인단|직선제|간선제|정관|징계|소송|가처분|이사회|집행부|제도\s*(?:개편|개선)|규정\s*개정|거버넌스|혁신|개혁|쇄신|사퇴|퇴진|책임|비판|반발|발언|저격|막말|의혹|논란|후원|출연금|재정|고발|배임|수사|조사|부조리|비위|위법|파헤|참관단|출장비)/u;
const KFA_ABBREVIATION_CONTEXT_PATTERN =
  /(?:\bKFA\b.{0,55}(?:축구|대표팀|국가대표|전력강화위원|전강위|감독\s*선임|회장\s*선거|선거인단|정관|청문회|개혁|쇄신|후원|출연금|재정|참관단|출장비|감사\s*(?:착수|결과|발표|보고서|처분|지적|후속)|National\s+Assembly|parliamentary|hearing|presidential\s+election|election\s+deadline|football\s+reform)|(?:축구|대표팀|국가대표|전력강화위원|전강위|감독\s*선임|회장\s*선거|선거인단|정관|청문회|개혁|쇄신|후원|출연금|재정|참관단|출장비|감사\s*(?:착수|결과|발표|보고서|처분|지적|후속)|National\s+Assembly|parliamentary|hearing|presidential\s+election|election\s+deadline|football\s+reform).{0,55}\bKFA\b)/iu;
const KFA_ADDITIONAL_GOVERNANCE_CONTEXT_PATTERN =
  /(?:\bKFA\b.{0,55}(?:책임|카르텔|밀실|비리|부패|거버넌스|선거\s*제도|진상\s*규명|문책|공정|인맥)|(?:책임|카르텔|밀실|비리|부패|거버넌스|선거\s*제도|진상\s*규명|문책|공정|인맥).{0,55}\bKFA\b)/iu;
const NON_FOOTBALL_KFA_CONTEXT_PATTERN =
  /(?:산림|영화|패션|의류|컬렉션|디자이너|쇼핑|뷰티|화장품|가구|식품|전자제품|프랜차이즈|외식업|가맹점|조찬포럼|fashion|forestry|film|franchise|financial|미국\s*(?:대통령|대선)|대통령\s*선거인단)/iu;
const EXPLICIT_NON_FOOTBALL_KFA_IDENTITY_PATTERN =
  /(?:(?:한국|대한)(?!\s*(?:축구협회|프로축구연맹))[가-힣]{1,18}(?:협회|연맹|산업협회)[\s()[\]{}·,，/:：|｜'‘’"“”\-–—]*\bKFA\b|\bKFA\b[\s()[\]{}·,，/:：|｜'‘’"“”\-–—]*(?:한국|대한)(?!\s*(?:축구협회|프로축구연맹))[가-힣]{1,18}(?:협회|연맹|산업협회)|Korea(?:n)?\s+(?!Football\s+Association\b)[A-Za-z][A-Za-z&'‘’\- ]{0,48}(?:Association|Federation)[\s()[\]{}·,，/:：|｜'‘’"“”\-–—]*\bKFA\b|\bKFA\b[\s()[\]{}·,，/:：|｜'‘’"“”\-–—]*Korea(?:n)?\s+(?!Football\s+Association\b)[A-Za-z][A-Za-z&'‘’\- ]{0,48}(?:Association|Federation))/iu;
const EXPLICIT_DOMESTIC_KFA_IDENTITY_PATTERN =
  /(?:(?:대한\s*축구협회|Korea(?:n)?\s+Football\s+Association)[\s()[\]{}·,，/:：|｜'‘’"“”\-–—]*\bKFA\b|\bKFA\b[\s()[\]{}·,，/:：|｜'‘’"“”\-–—]*(?:대한\s*축구협회|Korea(?:n)?\s+Football\s+Association))/iu;
const STRONG_DOMESTIC_KFA_OVERRIDE_PATTERN =
  /(?:대표팀|국가대표|전력강화위원|전강위).{0,45}(?:감독\s*선임|감사\s*(?:착수|결과|발표|보고서|처분|지적|후속)|청문회|정관|회장\s*선거)|(?:감독\s*선임|감사\s*(?:착수|결과|발표|보고서|처분|지적|후속)|청문회|정관|회장\s*선거).{0,45}(?:대표팀|국가대표|전력강화위원|전강위)|(?:회장\s*선거.{0,30}직선제|직선제.{0,30}회장\s*선거)/u;
const ABBREVIATED_ASSOCIATION_CONTEXT_PATTERN =
  /(?:축협.{0,45}(?:축구|한국\s*대표팀|한국\s*국가대표|대한민국\s*대표팀|전력강화위원|전강위|감독\s*선임|사령탑|회장(?:\s*선거)?|선출|선거인단|정관|국회|국회의원|문체위|청문회|책임|비판|개혁|쇄신|정치|카르텔|밀실|부패|비리|무너|권력|실세|폭로|저격|문제|바뀌|회유|사유화|독점|해산|임원진|핵심\s*실무진|후원|출연금|재정|참관단|출장비)|(?:축구|한국\s*대표팀|한국\s*국가대표|대한민국\s*대표팀|전력강화위원|전강위|감독\s*선임|사령탑|회장\s*선거|선출|선거인단|정관|국회|국회의원|문체위|청문회|책임|비판|개혁|쇄신|정치|카르텔|밀실|부패|비리|무너|권력|실세|폭로|저격|문제|바뀌|회유|사유화|독점|해산|임원진|핵심\s*실무진|후원|출연금|재정|참관단|출장비).{0,45}축협)/u;
const LIVESTOCK_COOPERATIVE_CONTEXT_PATTERN =
  /(?:축협\s*조합장|조합장.{0,20}축협|지역\s*축협\s*회장|축산업?\s*협동조합|농[·ㆍ]?축협|농협.{0,20}축협|농가.{0,20}축협|축협.{0,20}농가|축산\s*(?:농가|조합|업계)|한우\s*(?:농가|조합))/u;
const LIVESTOCK_COOPERATIVE_CUE_PATTERN =
  /(?:조합장|조합원|조합\s*관계자|지역\s*조합|협동조합|농협|농가|축산|한우|젖소|낙농|가축|가축시장|사료|상호금융|축산물|경영난|경제사업|금융사업)/u;
const GRATITUDE_CONTEXT_PATTERN =
  /(?:감사한\s*(?:마음|뜻|인사)|진심으로\s*감사|감사의\s*(?:말|뜻|마음|인사)|감사\s*(?:합니다|드립니다|드려요|해요)|감사\s*(?:인사|패|의\s*뜻|를?\s*전|마음)|(?:고맙|감사)의\s*마음)/u;
const EXPLICIT_AUDIT_CONTEXT_PATTERN =
  /(?:문체부|문화체육관광부)\s*(?:의\s*)?(?:특별\s*|특정\s*)?감사|(?:특별|특정)\s*감사|감사\s*(?:착수|결과|발표|보고서|처분|요구|지적|조사|후속\s*조치|재심의|수감)|감사를?\s*(?:받|벌이|실시|진행|요구|청구)/u;
const FOREIGN_NATIONAL_TEAM_CONTEXT_PATTERN =
  /(?:(?<![\p{Script=Hangul}\p{Script=Han}])(?:독일|이탈리아|일본|이집트|예멘|가나|포르투갈|스페인|프랑스|잉글랜드|영국|스코틀랜드|웨일스|아일랜드|브라질|아르헨티나|우루과이|파라과이|칠레|콜롬비아|에콰도르|페루|볼리비아|베네수엘라|네덜란드|벨기에|크로아티아|세르비아|슬로베니아|슬로바키아|체코|폴란드|루마니아|불가리아|헝가리|오스트리아|스위스|덴마크|스웨덴|노르웨이|핀란드|아이슬란드|그리스|우크라이나|러시아|튀르키예|터키|미국|멕시코|캐나다|호주|뉴질랜드|중국|대만|홍콩|베트남|태국|캄보디아|인도네시아|말레이시아|싱가포르|필리핀|미얀마|인도|파키스탄|방글라데시|네팔|사우디|사우디아라비아|카타르|이라크|이란|요르단|오만|아랍에미리트|UAE|쿠웨이트|바레인|시리아|레바논|이스라엘|팔레스타인|우즈베키스탄|카자흐스탄|키르기스스탄|타지키스탄|투르크메니스탄|북한|남아공|남아프리카공화국|모로코|알제리|튀니지|나이지리아|카메룬|세네갈|코트디부아르|말리|기니|콩고|우간다|케냐|탄자니아|잠비아|짐바브웨|日|中|美|獨|佛|英|伊)\s*(?:(?:의|도|은|는|이|가|에서|현지(?:의)?|측(?:의|도|은|는|이|가|에서)?)\s*|(?:[,·:：/()[\]{}'‘’"“”\-–—]\s*))*(?:(?:(?:남자|여자)\s*)?축구협회|(?:(?:남자|여자)\s*축구\s*)?(?:대표팀|국가대표|사령탑|감독|KFA\b))|\b(?:DFB|JFA|FIGC|EFA|FAI|UAEFA)\b)/iu;
const ADDITIONAL_FOREIGN_NATIONAL_TEAM_CONTEXT_PATTERN =
  /(?<![\p{Script=Hangul}\p{Script=Han}])(?:알바니아|조지아|보스니아|헤르체고비나|몬테네그로|북마케도니아|마케도니아|코소보|몰도바|리투아니아|라트비아|에스토니아|벨라루스|룩셈부르크|리히텐슈타인|몰타|키프로스|아르메니아|아제르바이잔|라오스|브루나이|동티모르|몽골|아프가니스탄|스리랑카|몰디브|부탄|수단|에티오피아|르완다|부룬디|앙골라|모잠비크|보츠와나|나미비아|말라위|가봉|감비아|라이베리아|시에라리온|토고|베냉|부르키나파소|니제르|차드|모리타니|마다가스카르|모리셔스|카보베르데|적도기니|코스타리카|파나마|온두라스|과테말라|엘살바도르|니카라과|자메이카|아이티|쿠바|도미니카공화국|트리니다드토바고)\s*(?:(?:의|도|은|는|이|가|에서|현지(?:의)?|측(?:의|도|은|는|이|가|에서)?)\s*|(?:[,·:：/()[\]{}'‘’"“”\-–—]\s*))*(?:(?:(?:남자|여자)\s*)?축구협회|(?:(?:남자|여자)\s*축구\s*)?(?:대표팀|국가대표|사령탑|감독|KFA\b))/u;
const NON_FOOTBALL_SPORT_CONTEXT_PATTERN =
  /(?:야구|농구|아이스하키|필드하키|하키|배구|핸드볼|럭비|풋살|탁구|배드민턴|테니스|수구|크리켓|소프트볼|e\s*스포츠|이스포츠|골프|사격|양궁|태권도|유도|레슬링|수영|육상|빙상|스키|대한(?:야구|농구|아이스하키|필드하키|하키|배구|핸드볼|럭비|풋살|탁구|배드민턴|테니스|수구|크리켓|소프트볼|e\s*스포츠|이스포츠)협회|\bKBO\b|\bKBL\b|\bWKBL\b|\bKOVO\b|\bKHL\b|\bMLB\b)/iu;
const NON_FOOTBALL_NATIONAL_TEAM_COACH_PATTERN =
  /(?:(?:야구|농구|아이스하키|필드하키|하키|배구|핸드볼|럭비|풋살|탁구|배드민턴|테니스|수구|크리켓|소프트볼|e\s*스포츠|이스포츠)\s*(?:(?:남자|여자)\s*)?(?:국가대표팀?|대표팀).{0,32}(?:감독|사령탑)|(?:감독|사령탑).{0,32}(?:야구|농구|아이스하키|필드하키|하키|배구|핸드볼|럭비|풋살|탁구|배드민턴|테니스|수구|크리켓|소프트볼|e\s*스포츠|이스포츠)\s*(?:(?:남자|여자)\s*)?(?:국가대표팀?|대표팀))/iu;
const EXPLICIT_FOOTBALL_CONTEXT_PATTERN =
  /(?:축구|대한\s*축구협회|한국\s*축구|한국축구|대한민국\s*축구|\bKFA\b|전력강화위원|전강위)/iu;
const KOREAN_COACH_REPLACEMENT_CONTEXT_PATTERN =
  /(?:홍명보\s*(?:감독)?\s*후임|후임.{0,24}홍명보)/u;
const UNRELATED_ENTITY_CLAUSE_BOUNDARY_PATTERN =
  /,\s*(?=(?:대한체육회|국민체육진흥공단|대한(?:야구|농구|아이스하키|배구|핸드볼|럭비|풋살)협회|한국야구위원회|\bKBO\b|\bKBL\b|\bWKBL\b|\bKOVO\b|국민의힘|더불어민주당))/giu;

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

function splitEvidenceSegments(text: string): string[] {
  return text
    .replace(UNRELATED_ENTITY_CLAUSE_BOUNDARY_PATTERN, ". ")
    .split(
      /(?:[\r\n]+|[;；]+|\.{2,}|…+|[!?]+(?:["'’”)}\]〉》」』】]+)?\s*|(?<!\d)\.(?!\d)(?:["'’”)}\]〉》」』】]+)?\s*)/u
    )
    .flatMap(splitIndependentCommaClauses)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function splitIndependentCommaClauses(segment: string): string[] {
  const clauses = segment.split(/,\s*/u);
  if (clauses.length < 2) {
    return clauses;
  }

  return clauses.reduce<string[]>((groups, clause) => {
    const trimmed = clause.trim();
    const startsNonFootballSportSubject =
      NON_FOOTBALL_SPORT_CONTEXT_PATTERN.test(trimmed) &&
      /(?:국가대표팀?|대표팀|협회|연맹)/u.test(trimmed);
    const previousClause = groups.at(-1) ?? "";
    const continuesBareDomesticComparison =
      /^(?:대한\s*축구협회|\bKFA\b)$/iu.test(previousClause.trim()) &&
      /(?:비교|사례|참고|검토|벤치마킹|대신)/u.test(trimmed);
    const startsForeignBody =
      hasExplicitNonKoreanNationalBody(trimmed) &&
      !continuesBareDomesticComparison;
    const startsPoliticalEntity =
      /^미국\s*(?:대통령|대선)/u.test(trimmed) &&
      !continuesBareDomesticComparison;

    if (
      groups.length === 0 ||
      startsNonFootballSportSubject ||
      startsForeignBody ||
      startsPoliticalEntity
    ) {
      groups.push(trimmed);
    } else {
      groups[groups.length - 1] = `${groups.at(-1)}, ${trimmed}`;
    }
    return groups;
  }, []);
}

function hasExplicitNonKoreanNationalBody(text: string): boolean {
  return (
    FOREIGN_NATIONAL_TEAM_CONTEXT_PATTERN.test(text) ||
    ADDITIONAL_FOREIGN_NATIONAL_TEAM_CONTEXT_PATTERN.test(text)
  );
}

function hasForeignCountryQualifiedKfa(text: string): boolean {
  return [
    FOREIGN_NATIONAL_TEAM_CONTEXT_PATTERN,
    ADDITIONAL_FOREIGN_NATIONAL_TEAM_CONTEXT_PATTERN
  ].some((pattern) => {
    const globalPattern = new RegExp(pattern.source, `${pattern.flags}g`);
    return Array.from(text.matchAll(globalPattern)).some((match) =>
      /\bKFA\b/iu.test(match[0])
    );
  });
}

function hasKfaAbbreviationContext(text: string): boolean {
  if (
    EXPLICIT_NON_FOOTBALL_KFA_IDENTITY_PATTERN.test(text) ||
    hasForeignCountryQualifiedKfa(text)
  ) {
    return false;
  }

  const hasNonFootballCue = NON_FOOTBALL_KFA_CONTEXT_PATTERN.test(text);
  return (
    (!hasNonFootballCue || STRONG_DOMESTIC_KFA_OVERRIDE_PATTERN.test(text)) &&
    (KFA_ABBREVIATION_CONTEXT_PATTERN.test(text) ||
      KFA_ADDITIONAL_GOVERNANCE_CONTEXT_PATTERN.test(text))
  );
}

function hasExplicitDomesticKfaIdentity(text: string): boolean {
  return (
    /대한\s*축구협회/u.test(text) ||
    EXPLICIT_DOMESTIC_KFA_IDENTITY_PATTERN.test(text)
  );
}

function hasLivestockCooperativeContext(text: string): boolean {
  return (
    LIVESTOCK_COOPERATIVE_CONTEXT_PATTERN.test(text) ||
    hasNamedLocalLivestockCooperativeContext(text) ||
    (/축협/u.test(text) && LIVESTOCK_COOPERATIVE_CUE_PATTERN.test(text))
  );
}

function hasAbbreviatedAssociationContext(text: string): boolean {
  return (
    !hasLivestockCooperativeContext(text) &&
    ABBREVIATED_ASSOCIATION_CONTEXT_PATTERN.test(text)
  );
}

function hasGratitudeContext(text: string): boolean {
  return GRATITUDE_CONTEXT_PATTERN.test(text);
}

function hasSemanticAuditMention(text: string): boolean {
  if (EXPLICIT_AUDIT_CONTEXT_PATTERN.test(text)) {
    return true;
  }

  return /감사/u.test(text) && !hasGratitudeContext(text);
}

function hasForeignNationalTeamContext(text: string): boolean {
  return (
    FOREIGN_NATIONAL_TEAM_CONTEXT_PATTERN.test(text) ||
    hasExplicitNonKoreanNationalBody(text)
  );
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
  return (
    DOMESTIC_FOOTBALL_CONTEXT_KEYWORDS.some((keyword) =>
      includesKeyword(text, keyword)
    ) ||
    KOREAN_COACH_REPLACEMENT_CONTEXT_PATTERN.test(text) ||
    hasKfaAbbreviationContext(text) ||
    hasAbbreviatedAssociationContext(text)
  );
}

function shouldCountGenericAssociation(text: string, people: Person[]): boolean {
  if (hasDomesticFootballContext(text)) {
    return true;
  }

  if (hasLocalFootballAssociationContext(text)) {
    return false;
  }

  return (
    /(?:축구협회|축구협회장).{0,55}(?:국회|국회의원|문체위|청문회|문체부|회장\s*선거|선출|선거인단|직선제|간선제|정관|규정\s*개정|감독\s*선임|전력강화위원|징계|가처분|이사회|집행부|책임|비판|반발|발언|저격|막말|의혹|논란|개혁|쇄신|후원|출연금|재정|고발|배임|수사|조사|참관단|출장비)/u.test(
      text
    ) ||
    /(?:국회|국회의원|문체위|청문회|문체부|회장\s*선거|선출|선거인단|직선제|간선제|정관|규정\s*개정|감독\s*선임|전력강화위원|징계|가처분|이사회|집행부|책임|비판|반발|발언|저격|막말|의혹|논란|개혁|쇄신|후원|출연금|재정|고발|배임|수사|조사|참관단|출장비).{0,55}(?:축구협회|축구협회장)/u.test(
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
  return (
    MCST_AUDIT_CONTEXT_KEYWORDS.some(
      (keyword) => keyword !== "KFA" && includesKeyword(text, keyword)
    ) || hasKfaAbbreviationContext(text)
  );
}

function includesMcstAuditIssueKeyword(
  fieldText: string,
  fullText: string,
  keyword: string
): boolean {
  if (!includesKeyword(fieldText, keyword)) {
    return false;
  }

  if (keyword.includes("감사")) {
    const hasSemanticAuditTerm = hasSemanticAuditMention(fieldText);
    const hasKfaAuditRelation =
      /(?:대한\s*축구협회|한국\s*축구|한국축구).{0,50}감사/u.test(
        fullText
      ) ||
      /감사.{0,50}(?:대한\s*축구협회|한국\s*축구|한국축구)/u.test(
        fullText
      ) ||
      /(?:문체부|문화체육관광부).{0,30}감사|감사.{0,30}(?:문체부|문화체육관광부)/u.test(
        fullText
      ) ||
      hasKfaAbbreviationContext(fullText);
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

function getIssueEvidenceSegments(
  issue: Issue,
  fieldText: string,
  people: Person[],
  blockBareKfaRebinding: boolean
): string[] {
  const sourceSegments = splitEvidenceSegments(fieldText);
  const eligibleSegments = sourceSegments.filter((segment) => {
    if (EXPLICIT_NON_FOOTBALL_KFA_IDENTITY_PATTERN.test(segment)) {
      return false;
    }

    if (
      blockBareKfaRebinding &&
      /\bKFA\b/iu.test(segment) &&
      !hasExplicitDomesticKfaIdentity(segment)
    ) {
      return false;
    }

    if (
      issue.excludedKeywords?.some((keyword) => includesKeyword(segment, keyword))
    ) {
      return false;
    }

    if (
      NON_FOOTBALL_SPORT_CONTEXT_PATTERN.test(segment) &&
      !EXPLICIT_FOOTBALL_CONTEXT_PATTERN.test(segment)
    ) {
      return false;
    }

    if (
      issue.id === COACH_APPOINTMENT_ISSUE_ID &&
      NON_FOOTBALL_NATIONAL_TEAM_COACH_PATTERN.test(segment)
    ) {
      return false;
    }

    if (
      issue.id === COACH_APPOINTMENT_ISSUE_ID &&
      hasForeignNationalTeamContext(segment) &&
      !hasDomesticFootballContext(segment) &&
      !KOREAN_COACH_REPLACEMENT_CONTEXT_PATTERN.test(segment)
    ) {
      return false;
    }

    return true;
  });

  return eligibleSegments.filter((segment) => {
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
        !hasForeignNationalTeamContext(segment) &&
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
  issue,
  people
}: {
  fieldText: string;
  fullText: string;
  issue: Issue;
  people: Person[];
}): string[] {
  if (
    issue.id === COACH_APPOINTMENT_ISSUE_ID &&
    hasForeignNationalTeamContext(fullText) &&
    !hasDomesticFootballContext(fullText) &&
    !KOREAN_COACH_REPLACEMENT_CONTEXT_PATTERN.test(fullText)
  ) {
    return [];
  }

  const evidenceSegments = getIssueEvidenceSegments(
    issue,
    fieldText,
    people,
    EXPLICIT_NON_FOOTBALL_KFA_IDENTITY_PATTERN.test(fullText) &&
      !hasExplicitDomesticKfaIdentity(fullText)
  );
  if (evidenceSegments.length === 0) {
    return [];
  }

  if (
    issue.id === KFA_EXECUTIVES_ISSUE_ID &&
    !evidenceSegments.some((segment) => shouldAssignKfaExecutiveIssue(segment, people))
  ) {
    return [];
  }

  return getIssueEvidenceKeywords(issue).filter((keyword) => {
    return evidenceSegments.some((segment) => {
      if (issue.id === KFA_EXECUTIVES_ISSUE_ID) {
        return includesKfaExecutiveIssueKeyword(segment, keyword);
      }

      if (isMcstAuditIssue(issue)) {
        return includesMcstAuditIssueKeyword(segment, segment, keyword);
      }

      if (
        (keyword === "축구협회장" || keyword === "대한축구협회장") &&
        !shouldCountGenericAssociation(segment, people)
      ) {
        return false;
      }

      return includesKeyword(segment, keyword);
    });
  });
}

function getOrganizationMatches(
  fieldText: string,
  fullText: string,
  people: Person[]
): string[] {
  const evidenceSegments = splitEvidenceSegments(fieldText);
  const blockBareKfaRebinding =
    EXPLICIT_NON_FOOTBALL_KFA_IDENTITY_PATTERN.test(fullText) &&
    !hasExplicitDomesticKfaIdentity(fullText);
  const matches = ORGANIZATION_KEYWORDS.filter((keyword) => {
    const matchingSegments = evidenceSegments.filter((segment) =>
      includesKeyword(segment, keyword)
    );
    if (matchingSegments.length === 0) {
      return false;
    }

    if (keyword === "KFA") {
      if (blockBareKfaRebinding) {
        return false;
      }
      return matchingSegments.some((segment) => hasDomesticFootballContext(segment));
    }

    if (
      (ABBREVIATED_ORGANIZATION_KEYWORDS as readonly string[]).includes(keyword)
    ) {
      return matchingSegments.some((segment) =>
        hasAbbreviatedAssociationContext(segment)
      );
    }

    if ((GENERIC_ORGANIZATION_KEYWORDS as readonly string[]).includes(keyword)) {
      return matchingSegments.some((segment) =>
        shouldCountGenericAssociation(segment, people)
      );
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
      fieldText:
        location === "title" && issue.id === COACH_APPOINTMENT_ISSUE_ID
          ? fieldText.replace(/(?:\.{2,}|…+)/gu, " ")
          : fieldText,
      fullText,
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

    const personMatches = unique(
      splitEvidenceSegments(fieldText).flatMap((segment) =>
        getPersonKeywordMatches(person, segment, segment)
      )
    );
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
    if (keyword === "감사" && !hasSemanticAuditMention(fieldText)) {
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

function getCrossFieldPersonKeywordMatches(
  person: Person,
  subjectField: string,
  contextField: string
): string[] {
  const subjectSegments = splitEvidenceSegments(subjectField);
  const contextLead = splitEvidenceSegments(contextField)[0] ?? "";

  // Cross-field context is only intentional for a single-subject headline (or
  // description) whose counterpart lead disambiguates that subject. Never let
  // a name in a later sentence borrow an organization from another field.
  if (subjectSegments.length !== 1 || !contextLead) {
    return [];
  }

  return getPersonKeywordMatches(person, subjectSegments[0], contextLead);
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

  const hasCrossFieldAssociationChairEvidence =
    /축구협회장/u.test(title) &&
    !hasLocalFootballAssociationContext(title) &&
    !hasLivestockCooperativeContext(title) &&
    splitEvidenceSegments(summary).some(
      (segment) =>
        hasDomesticFootballContext(segment) &&
        GOVERNANCE_SIGNAL_PATTERN.test(segment)
    );
  if (hasCrossFieldAssociationChairEvidence) {
    addUnique(titleClassification.matchedKeywords, "축구협회장");
    addUnique(titleClassification.organizationKeywords, "축구협회장");
  }

  const titleRelevanceScore = getFieldScore(titleClassification, "title");
  const summaryRelevanceScore = getFieldScore(summaryClassification, "summary");
  const issueTags = unique([
    ...titleClassification.issueTags,
    ...summaryClassification.issueTags
  ]);
  const aggregatePersonMatches = input.people.flatMap((person) => {
    if (!person.published) {
      return [];
    }

    // Field classification already handles evidence within one title/summary
    // segment. Aggregate only the intentional cross-field case (for example a
    // name in the title and its disambiguating organization in the summary),
    // not unrelated sentences within the same summary.
    const crossFieldMatches = unique([
      ...getCrossFieldPersonKeywordMatches(person, title, summary),
      ...getCrossFieldPersonKeywordMatches(person, summary, title)
    ]);
    return crossFieldMatches.map((keyword) => ({
      personId: person.id,
      keyword
    }));
  });
  const personTags = unique([
    ...titleClassification.personTags,
    ...summaryClassification.personTags,
    ...aggregatePersonMatches.map((match) => match.personId)
  ]);
  const matchedKeywords = unique([
    ...titleClassification.matchedKeywords,
    ...summaryClassification.matchedKeywords,
    ...aggregatePersonMatches.map((match) => match.keyword)
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
