import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

import { classifyItemText, getSearchQueries } from "../lib/classify";
import { canonicalizeUrl, dedupeItems } from "../lib/dedupe";
import {
  getItemRetentionDays,
  isPublishedAtWithinRetention
} from "../lib/item-retention";
import {
  hasLocalFootballAssociationContext,
  hasNamedLocalLivestockCooperativeContext
} from "../lib/korean-localities";
import { normalizePublisher, stripInlineHtml, truncateSummary } from "../lib/normalize";
import type { Issue, Person, RadarItem, RelevanceTier } from "../lib/schema";
import { persistCollectionRun, type CollectorRunResult } from "./collection-run";
import { readIssues, readItems, readPeople } from "./data-io";

type NaverNewsItem = {
  title: string;
  originallink?: string;
  link: string;
  description: string;
  pubDate: string;
};

type NewsCandidateClassification = {
  issueTags: string[];
  personTags: string[];
  matchedKeywords: string[];
  relevanceScore: number;
  titleIssueTags?: string[];
  summaryIssueTags?: string[];
  titlePersonTags?: string[];
  summaryPersonTags?: string[];
  titleMatchedKeywords?: string[];
  summaryMatchedKeywords?: string[];
  titleRelevanceScore?: number;
  summaryRelevanceScore?: number;
};

type NewsCandidateInput = {
  title?: string;
  summary?: string;
  classification: NewsCandidateClassification;
};

type NewsCandidateRelevanceTier = RelevanceTier | "reject";

type NaverNewsObservation = {
  title: string;
  summary: string;
  originalUrl: string;
  publishedAt: string;
  queries: string[];
};

export const DEFAULT_NAVER_QUERY_DELAY_MS = 800;
export const MAX_NAVER_SEARCH_QUERIES = 100;
export const NAVER_NEWS_DISPLAY_COUNT = 40;
export const NAVER_NEWS_TIMEOUT_MS = 10000;

const FOOTBALL_CONTEXT_KEYWORDS = [
  "대한축구협회",
  "대한 축구협회",
  "대한축구협회장",
  "대한 축구협회장",
  "축구협회",
  "축구협회장",
  "K-축구혁신위원회",
  "K-혁신위",
  "축구혁신위",
  "축구 혁신",
  "한국 축구",
  "대표팀 감독",
  "대표팀 감독 선임",
  "전력강화위원회"
];

const GENERIC_ASSOCIATION_KEYWORDS = new Set([
  "축구협회",
  "축구협회장"
]);

const BROAD_AUDIT_KEYWORDS = new Set([
  "감사",
  "축구협회 감사"
]);

const STRONG_KFA_AUDIT_CONTEXT_KEYWORDS = [
  "문체부",
  "문화체육관광부",
  "대한축구협회",
  "대한 축구협회",
  "축구협회 감사",
  "축구협회 특정 감사",
  "대표팀 감독",
  "대표팀 감독 선임",
  "감독 선임",
  "전력강화위원회",
  "한국 축구",
  "한국축구",
  "대한민국 축구",
  "대한민국 대표팀"
];

const LOCAL_COMPETITION_CONTEXT_PATTERNS = [
  /(?:고등학교|고교|중학교|초등학교|U-?\d{2}|여성\s*축구\s*단|여자\s*축구\s*단)/u,
  /(?:생활체육|구청|시청|군청|지역\s*리그|지역리그|권역\s*리그|전국대회|도지사배)/u,
  /(?:대구\/경북|대구·경북|충북\s*축구협회|충주시\s*축구협회|시흥시\s*축구협회)/u
];

const COMPETITION_RESULT_PATTERNS = [
  /(?:전승|무패|우승|정상|최강|최종전|승리|대회|리그)/u
];

const LOW_VALUE_PERFORMANCE_CONTEXT_PATTERNS = [
  /(?:월드컵|본선|조별리그|32강|16강|탈락|조기탈락|경기력|패배|참사)/u,
  /(?:원흉|책임자로\s*지목|레전드들|슈퍼스타|외신이\s*본|일본\s*언론|충격진단|탓만|불화|패자|전술\s*문제|쓴소리|골\s*걱정)/u
];

const OPERATIONAL_OFFICIATING_CONTEXT_PATTERN =
  /(?:심판|주심|부심|VAR|비디오\s*판독|판정|오심|경기\s*규칙|퇴장|경고)/iu;

const TRACKED_GOVERNANCE_CONTEXT_KEYWORDS = [
  "문체부",
  "문화체육관광부",
  "대한축구협회장",
  "대한 축구협회장",
  "축구협회장",
  "K-축구혁신위원회",
  "K-축구 혁신",
  "K- 축구 혁신",
  "축구혁신위",
  "축구 혁신",
  "혁신위",
  "박지성 혁신위",
  "회장 선거",
  "선거인단",
  "정관",
  "감사 결과",
  "특정 감사",
  "행정소송",
  "징계",
  "청문회",
  "이사회",
  "집행부",
  "전력강화위원",
  "전력강화위원회",
  "대표팀 감독 선임",
  "감독 선임 절차",
  "제도 개편",
  "거버넌스",
  "인물보다 구조",
  "후속 조치"
];

const KFA_ACCOUNTABILITY_CONTEXT_PATTERNS = [
  /(?:대한\s*축구협회|축구협회|축협|KFA|한국\s*축구|한국축구|대한민국\s*축구).{0,50}(?:청문회|감사(?!\s*(?:합니다|드립니다|인사|패|를?\s*전))|조사|해명|사퇴|선거|선거인단|정관|징계|소송|가처분|이사회|집행부|전력강화위원회|감독\s*선임|선임\s*절차|제도\s*개편|거버넌스|혁신|개혁|쇄신|대수술|대변혁|구조|카르텔|비리|무원칙|책임|논란|비판|직격|후속\s*조치)/u,
  /(?:청문회|감사(?!\s*(?:합니다|드립니다|인사|패|를?\s*전))|조사|해명|사퇴|선거|선거인단|정관|징계|소송|가처분|이사회|집행부|전력강화위원회|감독\s*선임|선임\s*절차|제도\s*개편|거버넌스|혁신|개혁|쇄신|대수술|대변혁|구조|카르텔|비리|무원칙|책임|논란|비판|직격|후속\s*조치).{0,50}(?:대한\s*축구협회|축구협회|축협|KFA|한국\s*축구|한국축구|대한민국\s*축구)/u
];

const PERSON_GOVERNANCE_CONTEXT_PATTERNS = [
  /(?:문체부|문화체육관광부|문체위|국회|청문회|전력강화위원회|감독\s*선임|선임\s*절차|회장\s*선거|선거인단|정관|징계|소송|가처분|이사회|집행부|후속\s*조치|해명|사퇴)/u,
  /전력강화위원/u,
  /(?:감독|사령탑|홍명보).{0,24}(?:선임|후보|후임|차기|지원|관심|러브콜|의혹|수사|소환|논란)/u,
  /(?:선임|후보|후임|차기|지원설|러브콜|의혹|수사|소환|논란).{0,24}(?:감독|사령탑|홍명보)/u,
  /(?:감독|사령탑|홍명보).{0,24}(?:자진|사퇴|퇴진|OUT)|(?:자진|사퇴|퇴진|OUT).{0,24}(?:감독|사령탑|홍명보)/iu,
  /(?:정몽규|허정무|이임생|박지성).{0,35}(?:떠난|물러난|퇴임|임기|상임위|집행위원|협회장)|(?:떠난|물러난|퇴임|임기|상임위|집행위원|협회장).{0,35}(?:정몽규|허정무|이임생|박지성)/u,
  /선거\s*(?:운동|사무원|후보|캠프|득표|투표|대의원|인단)/u,
  /(?:정몽규|허정무).{0,40}선거|선거.{0,40}(?:정몽규|허정무)/u,
  /(?:홍명보|정몽규|허정무|이임생|박지성|김병지|이영표|신문선).{0,45}(?:임시\s*감독|감독\s*체제|출연금|후원|참관단|출장비|비판|반발|저격|막말|의혹|논란|혁신|개혁|부회장)|(?:임시\s*감독|감독\s*체제|출연금|후원|참관단|출장비|비판|반발|저격|막말|의혹|논란|혁신|개혁|부회장).{0,45}(?:홍명보|정몽규|허정무|이임생|박지성|김병지|이영표|신문선)/u,
  /감사(?!\s*(?:합니다|드립니다|인사|패|를?\s*전|의\s*뜻|인사를))/u
];

const STRONG_PERSON_ISSUE_KEYWORDS = new Set([
  "감독 선임",
  "감독 후보",
  "전력강화위원회",
  "문체부 감사",
  "문화체육관광부 감사",
  "조사 결과",
  "회장 선거",
  "선거인단",
  "선거인",
  "후보 등록",
  "정관",
  "정관 개정",
  "규정 개정",
  "제도 개편",
  "K-축구혁신위원회",
  "축구혁신위",
  "혁신위원회",
  "축구 혁신"
]);

const KOREAN_FOOTBALL_CONTEXT_KEYWORDS = [
  "대한축구협회",
  "대한 축구협회",
  "대한축구협회장",
  "대한 축구협회장",
  "K-축구혁신위원회",
  "K-축구 혁신위원회",
  "K-축구 혁신위",
  "K-축구 혁신",
  "K축구혁신위",
  "K축구 혁신위",
  "K-혁신위",
  "축구혁신위",
  "축구 혁신위원회",
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
];

const FOREIGN_FOOTBALL_CONTEXT_PATTERNS = [
  /(?<![\p{Script=Hangul}\p{Script=Han}])(?:독일|이탈리아|일본|이집트|예멘|가나|포르투갈|스페인|프랑스|잉글랜드|영국|스코틀랜드|웨일스|아일랜드|브라질|아르헨티나|우루과이|파라과이|칠레|콜롬비아|에콰도르|페루|볼리비아|베네수엘라|네덜란드|벨기에|크로아티아|세르비아|슬로베니아|슬로바키아|체코|폴란드|루마니아|불가리아|헝가리|오스트리아|스위스|덴마크|스웨덴|노르웨이|핀란드|아이슬란드|그리스|우크라이나|러시아|튀르키예|터키|미국|멕시코|캐나다|호주|뉴질랜드|중국|대만|홍콩|베트남|태국|캄보디아|인도네시아|말레이시아|싱가포르|필리핀|미얀마|인도|파키스탄|방글라데시|네팔|사우디|사우디아라비아|카타르|이라크|이란|요르단|오만|아랍에미리트|UAE|쿠웨이트|바레인|시리아|레바논|이스라엘|팔레스타인|우즈베키스탄|카자흐스탄|키르기스스탄|타지키스탄|투르크메니스탄|북한|남아공|남아프리카공화국|모로코|알제리|튀니지|나이지리아|카메룬|세네갈|코트디부아르|말리|기니|콩고|우간다|케냐|탄자니아|잠비아|짐바브웨|日|中|美|獨|佛|英|伊)\s*(?:(?:의|도|은|는|이|가|에서|현지(?:의)?|측(?:의|도|은|는|이|가|에서)?)\s*|(?:[,·:：/()[\]{}'‘’"“”\-–—]\s*))*(?:(?:(?:남자|여자)\s*)?축구협회|(?:(?:남자|여자)\s*축구\s*)?(?:대표팀|국가대표|사령탑|감독|KFA\b))/iu,
  /\b(?:DFB|JFA|FIGC|EFA|FAI|UAEFA)\b/iu,
  /전차\s*군단/u
];
const ADDITIONAL_FOREIGN_FOOTBALL_CONTEXT_PATTERN =
  /(?<![\p{Script=Hangul}\p{Script=Han}])(?:알바니아|조지아|보스니아|헤르체고비나|몬테네그로|북마케도니아|마케도니아|코소보|몰도바|리투아니아|라트비아|에스토니아|벨라루스|룩셈부르크|리히텐슈타인|몰타|키프로스|아르메니아|아제르바이잔|라오스|브루나이|동티모르|몽골|아프가니스탄|스리랑카|몰디브|부탄|수단|에티오피아|르완다|부룬디|앙골라|모잠비크|보츠와나|나미비아|말라위|가봉|감비아|라이베리아|시에라리온|토고|베냉|부르키나파소|니제르|차드|모리타니|마다가스카르|모리셔스|카보베르데|적도기니|코스타리카|파나마|온두라스|과테말라|엘살바도르|니카라과|자메이카|아이티|쿠바|도미니카공화국|트리니다드토바고)\s*(?:(?:의|도|은|는|이|가|에서|현지(?:의)?|측(?:의|도|은|는|이|가|에서)?)\s*|(?:[,·:：/()[\]{}'‘’"“”\-–—]\s*))*(?:(?:(?:남자|여자)\s*)?축구협회|(?:(?:남자|여자)\s*축구\s*)?(?:대표팀|국가대표|사령탑|감독|KFA\b))/u;
const FOREIGN_CLUB_COACH_CONTEXT_PATTERN =
  /(?:(?:해외|현지|유럽|프로팀|구단|클럽|맨유|맨체스터|리버풀|첼시|아스널|토트넘|바르셀로나|레알|뮌헨|도르트문트|PSG).{0,30}(?:감독|사령탑).{0,25}(?:후보|선임|부임|후임|차기|거론)|(?:후보|선임|부임|후임|차기|거론).{0,25}(?:감독|사령탑).{0,30}(?:해외|현지|유럽|프로팀|구단|클럽|맨유|맨체스터|리버풀|첼시|아스널|토트넘|바르셀로나|레알|뮌헨|도르트문트|PSG))/iu;

const LISTING_TITLE_PATTERNS = [
  /^\s*(?:\[)?오늘의\s*주요일정/u,
  /^\s*(?:\[)?오늘의\s*일정/u,
  /^\s*(?:\[)?주요일정/u
];

const ATHLETE_ROSTER_OR_PROFILE_PATTERNS = [
  /\bMLS\b/u,
  /올스타전|로스터|와일드카드|최종\s*엔트리|엔트리|병역\s*혜택/u,
  /득점왕|축구인생|뽈터뷰|유망주/u
];

const POLITICAL_ANALOGY_CONTEXT_PATTERNS = [
  /(?:정청래|김어준|김민석|장성철|송영길|민주당|국민의힘|당대표|전당대회|당무위|선호투표|한판승부|체포방해|윤석열)/u
];

const STRONG_TITLE_SUBJECT_PATTERNS = [
  /(?:대한\s*축구협회|한국\s*축구|한국축구|대한민국\s*축구|한국프로축구연맹|프로축구연맹|K리그)/iu,
  /(?:전강위|전력강화위원|대표팀\s*감독\s*선임|국가대표팀\s*감독\s*선임|감독\s*선임|축구\s*혁신위|K-?\s*축구\s*혁신(?:위원회|위)?|K-혁신위)/u,
  /(?:대표팀|국가대표|홍명보).{0,30}(?:임시\s*감독|감독\s*체제|감독\s*공석|차기\s*감독|감독\s*후임)|(?:임시\s*감독|감독\s*체제|감독\s*공석|차기\s*감독|감독\s*후임).{0,30}(?:대표팀|국가대표|홍명보)/u,
  /(?:한국|대한민국)\s*국가대표(?:팀)?.{0,25}(?:감독|사령탑).{0,20}(?:후보|선임|차기|후임)|(?:후보|선임|차기|후임).{0,20}(?:감독|사령탑).{0,25}(?:한국|대한민국)\s*국가대표(?:팀)?/u,
  /(?:문체부|문화체육관광부).{0,30}(?:축구협회|축협)|(?:축구협회|축협).{0,30}(?:특별\s*감사|감사\s*(?:착수|결과|발표))/u,
  /(?:문체부|문화체육관광부).{0,45}(?:월드컵|축구|대표팀|대한축)|(?:축구협회|축협).{0,30}(?:부조리|비위|위법|파헤|개혁|쇄신)/u,
  /(?:축구|대표팀|선수).{0,24}청문회|청문회.{0,24}(?:축구|대표팀|선수)/u
];

const BUNDLED_NEWS_TITLE_PATTERNS = [
  /(?:주요\s*뉴스|오늘의\s*뉴스|헤드라인|이슈\s*종합|뉴스\s*Top\s*10|세상의\s*지식)/iu
];

const GRATITUDE_CONTEXT_PATTERNS = [
  /(?:감사한\s*(?:마음|뜻|인사)|진심으로\s*감사|감사의\s*(?:말|뜻|마음|인사)|감사\s*(?:합니다|드립니다|드려요|해요)|감사\s*(?:인사|패|를?\s*전|의\s*뜻|인사를|마음)|(?:고맙|감사)의\s*마음)/u,
  /(?:기회|응원|지원|성원)을?\s*주신.{0,30}(?:감사|고맙)/u
];

const EXPLICIT_AUDIT_CONTEXT_PATTERN =
  /(?:문체부|문화체육관광부)\s*(?:의\s*)?(?:특별\s*|특정\s*)?감사|(?:특별|특정)\s*감사|감사\s*(?:착수|결과|발표|보고서|처분|요구|지적|조사|후속\s*조치|재심의|수감)|감사를?\s*(?:받|벌이|실시|진행|요구|청구)/u;
const KFA_ABBREVIATION_CONTEXT_PATTERN =
  /(?:\bKFA\b.{0,55}(?:축구|대표팀|국가대표|전력강화위원|전강위|감독\s*선임|회장\s*선거|선거인단|정관|청문회|개혁|쇄신|후원|출연금|재정|참관단|출장비|감사\s*(?:착수|결과|발표|보고서|처분|지적|후속)|National\s+Assembly|parliamentary|hearing|presidential\s+election|election\s+deadline|football\s+reform)|(?:축구|대표팀|국가대표|전력강화위원|전강위|감독\s*선임|회장\s*선거|선거인단|정관|청문회|개혁|쇄신|후원|출연금|재정|참관단|출장비|감사\s*(?:착수|결과|발표|보고서|처분|지적|후속)|National\s+Assembly|parliamentary|hearing|presidential\s+election|election\s+deadline|football\s+reform).{0,55}\bKFA\b)/iu;
const KFA_ADDITIONAL_GOVERNANCE_CONTEXT_PATTERN =
  /(?:\bKFA\b.{0,55}(?:책임|카르텔|밀실|비리|부패|거버넌스|선거\s*제도|진상\s*규명|문책|공정|인맥)|(?:책임|카르텔|밀실|비리|부패|거버넌스|선거\s*제도|진상\s*규명|문책|공정|인맥).{0,55}\bKFA\b)/iu;
const KFA_GOVERNANCE_CUE_PATTERN =
  /(?:전력강화위원|전강위|감독\s*선임|회장\s*선거|선거인단|정관|청문회|개혁|쇄신|후원|출연금|재정|참관단|출장비|감사\s*(?:착수|결과|발표|보고서|처분|지적|후속)|National\s+Assembly|parliamentary|hearing|presidential\s+election|election\s+deadline|football\s+reform)/iu;
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
const NATIONAL_ASSOCIATION_GOVERNANCE_PATTERN =
  /(?:축구협회(?:장)?.{0,65}(?:국회|국회의원|문체위|청문회|문체부|문화체육관광부|전력강화위원|감독\s*선임|(?:회장\s*)?(?:보궐\s*)?선거(?:제도|제|방식|규정|기한)?|선출(?:\s*기한)?|선거인단|직선제|간선제|체육관\s*선거|직무대행|정관|규정\s*개정|구조\s*개혁|해명|사퇴|징계|수사|조사|책임|비판|개혁|쇄신|반발|발언|저격|막말|의혹|논란|비리|부패|숨은\s*(?:실세|권력)|핵심\s*실무진|폭로|회유|사유화|독점|카르텔|해산|임원진|후원|출연금|재정|참관단|출장비)|(?:국회|국회의원|문체위|청문회|문체부|문화체육관광부|전력강화위원|감독\s*선임|(?:회장\s*)?(?:보궐\s*)?선거(?:제도|제|방식|규정|기한)?|선출(?:\s*기한)?|선거인단|직선제|간선제|체육관\s*선거|직무대행|정관|규정\s*개정|구조\s*개혁|해명|사퇴|징계|수사|조사|책임|비판|개혁|쇄신|반발|발언|저격|막말|의혹|논란|비리|부패|숨은\s*(?:실세|권력)|핵심\s*실무진|폭로|회유|사유화|독점|카르텔|해산|임원진|후원|출연금|재정|참관단|출장비).{0,65}축구협회(?:장)?)/u;

const NON_FOOTBALL_SPORT_CONTEXT_PATTERN =
  /(?:야구|농구|아이스하키|필드하키|하키|배구|핸드볼|럭비|풋살|탁구|배드민턴|테니스|수구|크리켓|소프트볼|e\s*스포츠|이스포츠|골프|사격|양궁|태권도|유도|레슬링|수영|육상|빙상|스키|프로야구|메이저리그|잠실야구장|대한(?:야구|농구|아이스하키|필드하키|하키|배구|핸드볼|럭비|풋살|탁구|배드민턴|테니스|수구|크리켓|소프트볼|e\s*스포츠|이스포츠)협회|\bKBO\b|\bKBL\b|\bWKBL\b|\bKOVO\b|\bKHL\b|\bMLB\b)/iu;
const NON_FOOTBALL_NATIONAL_TEAM_COACH_PATTERN =
  /(?:(?:야구|농구|아이스하키|필드하키|하키|배구|핸드볼|럭비|풋살|탁구|배드민턴|테니스|수구|크리켓|소프트볼|e\s*스포츠|이스포츠)\s*(?:(?:남자|여자)\s*)?(?:국가대표팀?|대표팀).{0,32}(?:감독|사령탑)|(?:감독|사령탑).{0,32}(?:야구|농구|아이스하키|필드하키|하키|배구|핸드볼|럭비|풋살|탁구|배드민턴|테니스|수구|크리켓|소프트볼|e\s*스포츠|이스포츠)\s*(?:(?:남자|여자)\s*)?(?:국가대표팀?|대표팀))/iu;
const EXPLICIT_FOOTBALL_TITLE_PATTERN =
  /(?:축구|대한\s*축구협회|축협|\bKFA\b|전강위)/iu;
const NATIONAL_GOVERNANCE_BRIDGE_PATTERN =
  /(?:국회|문체위|청문회|대한\s*축구협회|축협|K-?\s*축구\s*혁신|(?:한국|대한민국)\s*축구.{0,40}(?:개혁|혁신))/iu;
const SUMMARY_KFA_IMPACT_PATTERN =
  /(?:대한\s*축구협회(?:장)?|축구협회장|\bKFA\b).{0,100}(?:영향|적용|개선|개혁|혁신|선거|선출|투표|정관|규정|직선제|개편|발판|불쏘시개|수순)/iu;
const EXPLICIT_KOREAN_NATIONAL_BODY_PATTERN =
  /(?:대한\s*축구협회|대한민국\s*(?:축구|대표팀|국가대표)|한국\s*(?:축구|대표팀|국가대표)|K-?\s*축구\s*혁신)/iu;
const KOREAN_COACH_APPOINTMENT_CONTEXT_PATTERN =
  /(?:(?:한국|대한민국|韓).{0,30}(?:부임|감독|사령탑|후임|후보|러브콜|한국행)|(?:부임|감독|사령탑|후임|후보|러브콜|한국행).{0,30}(?:한국|대한민국|韓))/iu;
const KOREAN_COACH_REPLACEMENT_CONTEXT_PATTERN =
  /(?:홍명보\s*(?:감독)?\s*후임|후임.{0,24}홍명보)/u;
const COMPARISON_CUE_PATTERN = /(?:비교|사례|참고|검토|벤치마킹)/u;
const STRUCTURAL_GOVERNANCE_CUE_PATTERN =
  /(?:카르텔|인맥|밀실|비리|부패|거버넌스|운영\s*책임|개혁|혁신|구조)/u;
const COACH_PROCESS_CUE_PATTERN =
  /(?:감독\s*선임(?:\s*(?:과정|전말))?|선임\s*과정|차기\s*(?:감독|사령탑)|(?:감독|사령탑)\s*(?:후보|후임)|홍명보.{0,30}(?:자진\s*사퇴|사퇴))/u;
const EXPLICIT_NON_FOOTBALL_BODY_PATTERN =
  /(?:(?:야구|농구|아이스하키|필드하키|하키|배구|핸드볼|럭비|풋살|탁구|배드민턴|테니스|수구|크리켓|소프트볼|e\s*스포츠|이스포츠|골프|사격|양궁|태권도|유도|레슬링|수영|육상|빙상|스키).{0,24}(?:협회|연맹|국가대표팀?|대표팀|감독|사령탑)|(?:협회|연맹|국가대표팀?|대표팀|감독|사령탑).{0,24}(?:야구|농구|아이스하키|필드하키|하키|배구|핸드볼|럭비|풋살|탁구|배드민턴|테니스|수구|크리켓|소프트볼|e\s*스포츠|이스포츠|골프|사격|양궁|태권도|유도|레슬링|수영|육상|빙상|스키)|\b(?:KBO|KBL|WKBL|KOVO|KHL|MLB)\b)/iu;
const DOMESTIC_COACH_SUMMARY_PATTERN =
  /(?:한국|대한민국)\s*축구.{0,90}(?:(?:국가\s*)?대표팀.{0,45}(?:감독|사령탑).{0,60}(?:선임|후보|차기|지원|거론)|차기\s*(?:대표팀\s*)?(?:감독|사령탑)|(?:감독|사령탑).{0,35}(?:선임|후보|지원))/u;
const DIRECT_NATIONAL_GOVERNANCE_CUE_PATTERN =
  /(?:청문회|회장\s*(?:후보|선거|출마)|후보\s*등록|보궐\s*선거|선출|직선제|간선제|체육관\s*선거|정관|혁신위|개혁|혁신|쇄신|숨은\s*(?:실세|권력)|핵심\s*실무자|카르텔|참관단|출장비|후원|출연금|재정|감독\s*(?:공개\s*)?(?:채용|모집|선임)|임시\s*감독\s*체제)/u;
const AGRICULTURAL_COOPERATIVE_TITLE_PATTERN =
  /(?:농협|농업협동조합|조합원|조합장|축산경제|농업|농촌)/u;
const LOCAL_ACTOR_NATIONAL_GOVERNANCE_PATTERN =
  /(?:(?:정몽규|박지성|이영표|홍명보|이임생).{0,60}(?:뭘\s*(?:안다고|아나|아냐|알아)|옹호|희생|잘못|발언|논란|비판|반박|막말|직격|지적|사퇴\s*요구|혁신위원|개혁\s*(?:후퇴|필요|촉구)|(?:원래|원상태)로\s*돌아가(?:진|지는|지)?\s*않|회장\s*출마|정몽규\s*체제)|(?:뭘\s*(?:안다고|아나|아냐|알아)|옹호|희생|잘못|발언|논란|비판|반박|막말|직격|지적|사퇴\s*요구|혁신위원|개혁\s*(?:후퇴|필요|촉구)|(?:원래|원상태)로\s*돌아가(?:진|지는|지)?\s*않|회장\s*출마|정몽규\s*체제).{0,60}(?:정몽규|박지성|이영표|홍명보|이임생))/u;
const UNRELATED_ENTITY_CLAUSE_BOUNDARY_PATTERN =
  /,\s*(?=(?:대한체육회|국민체육진흥공단|대한(?:야구|농구|아이스하키|배구|핸드볼|럭비|풋살)협회|한국야구위원회|\bKBO\b|\bKBL\b|\bWKBL\b|\bKOVO\b|국민의힘|더불어민주당))/giu;

function stableItemId(url: string): string {
  return `item_${crypto.createHash("sha1").update(url).digest("hex").slice(0, 16)}`;
}

function toIsoDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function isNaverNewsItem(value: unknown): value is NaverNewsItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.title === "string" &&
    candidate.title.length > 0 &&
    typeof candidate.link === "string" &&
    isHttpUrl(candidate.link) &&
    typeof candidate.description === "string" &&
    typeof candidate.pubDate === "string" &&
    (candidate.originallink === undefined ||
      (typeof candidate.originallink === "string" &&
        (candidate.originallink === "" || isHttpUrl(candidate.originallink))))
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function getNaverQueryDelayMs(
  value = process.env.NAVER_QUERY_DELAY_MS
): number {
  if (!value) {
    return DEFAULT_NAVER_QUERY_DELAY_MS;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5000) {
    return DEFAULT_NAVER_QUERY_DELAY_MS;
  }

  return parsed;
}

export function getNaverFetchTimeoutMs(
  value = process.env.NAVER_FETCH_TIMEOUT_MS
): number {
  if (!value) {
    return NAVER_NEWS_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1000 || parsed > 30000) {
    return NAVER_NEWS_TIMEOUT_MS;
  }

  return parsed;
}

async function fetchNaverNews(query: string): Promise<NaverNewsItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return [];
  }

  const url = new URL("https://openapi.naver.com/v1/search/news.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(NAVER_NEWS_DISPLAY_COUNT));
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "date");

  const response = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret
    },
    signal: AbortSignal.timeout(getNaverFetchTimeoutMs())
  });

  if (!response.ok) {
    throw new Error(`Naver News API failed for "${query}": ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("items" in data)) {
    throw new Error(`Naver News API returned an invalid response for "${query}"`);
  }

  const { items } = data as { items?: unknown };
  if (!Array.isArray(items)) {
    throw new Error(`Naver News API returned invalid items for "${query}"`);
  }
  return items.filter(isNaverNewsItem);
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
      (COMPARISON_CUE_PATTERN.test(trimmed) || /대신/u.test(trimmed));
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

function normalizeHeadlineEllipses(text: string): string {
  return text.replace(/(?:\.{2,}|…+)/gu, " ");
}

function hasNonFootballNationalTeamCoachContext(text: string): boolean {
  return splitEvidenceSegments(text).some((segment) =>
    NON_FOOTBALL_NATIONAL_TEAM_COACH_PATTERN.test(segment)
  );
}

function hasFieldScopedLivestockCooperativeContext(
  ...fields: string[]
): boolean {
  const hasSameFieldEvidence = fields.some((field) =>
    splitEvidenceSegments(field).some((segment) =>
      hasLivestockCooperativeContext(segment)
    )
  );
  if (hasSameFieldEvidence) {
    return true;
  }

  const [title = "", ...contextFields] = fields;
  const contextText = contextFields.join(" ");
  const hasExplicitNationalGovernance = splitEvidenceSegments(
    contextText
  ).some(
    (segment) =>
      EXPLICIT_KOREAN_NATIONAL_BODY_PATTERN.test(segment) &&
      (KFA_GOVERNANCE_CUE_PATTERN.test(segment) ||
        NATIONAL_ASSOCIATION_GOVERNANCE_PATTERN.test(segment))
  );

  return (
    !hasExplicitNationalGovernance &&
    /축협/u.test(title) &&
    LIVESTOCK_COOPERATIVE_CUE_PATTERN.test(contextText)
  );
}

function hasExplicitNonKoreanNationalBody(text: string): boolean {
  return (
    FOREIGN_FOOTBALL_CONTEXT_PATTERNS.some((pattern) => pattern.test(text)) ||
    ADDITIONAL_FOREIGN_FOOTBALL_CONTEXT_PATTERN.test(text)
  );
}

function hasForeignCountryQualifiedKfa(text: string): boolean {
  return [
    ...FOREIGN_FOOTBALL_CONTEXT_PATTERNS,
    ADDITIONAL_FOREIGN_FOOTBALL_CONTEXT_PATTERN
  ].some((pattern) => {
    const globalPattern = new RegExp(pattern.source, `${pattern.flags}g`);
    return Array.from(text.matchAll(globalPattern)).some((match) =>
      /\bKFA\b/iu.test(match[0])
    );
  });
}

function isNationalAssociationGovernanceSegment(segment: string): boolean {
  return (
    !hasLivestockCooperativeContext(segment) &&
    !hasExplicitNonKoreanNationalBody(segment) &&
    (!hasLocalFootballAssociationContext(segment) ||
      /대한\s*축구협회/u.test(segment)) &&
    NATIONAL_ASSOCIATION_GOVERNANCE_PATTERN.test(segment)
  );
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

function hasAbbreviatedAssociationContext(text: string): boolean {
  return (
    !hasLivestockCooperativeContext(text) &&
    ABBREVIATED_ASSOCIATION_CONTEXT_PATTERN.test(text)
  );
}

function hasLivestockCooperativeContext(text: string): boolean {
  return (
    LIVESTOCK_COOPERATIVE_CONTEXT_PATTERN.test(text) ||
    hasNamedLocalLivestockCooperativeContext(text) ||
    (/축협/u.test(text) && LIVESTOCK_COOPERATIVE_CUE_PATTERN.test(text))
  );
}

function hasDomesticKfaComparisonContext(text: string): boolean {
  return splitEvidenceSegments(text).some((segment) => {
    if (
      !/\bKFA\b/iu.test(segment) ||
      !COMPARISON_CUE_PATTERN.test(segment) ||
      hasForeignCountryQualifiedKfa(segment)
    ) {
      return false;
    }

    // KFA is the Korean side only when a second, independently recognizable
    // foreign body remains in the same evidence segment after removing the
    // acronym. This keeps `쿠웨이트 KFA` foreign while allowing
    // `DFB와 KFA 제도 비교`.
    return hasExplicitNonKoreanNationalBody(
      segment.replace(/\bKFA\b/giu, " ")
    );
  });
}

function hasDomesticStructuralComparisonContext(
  title: string,
  summary: string
): boolean {
  const summaryLead = splitEvidenceSegments(summary)[0] ?? "";
  return (
    COMPARISON_CUE_PATTERN.test(title) &&
    STRUCTURAL_GOVERNANCE_CUE_PATTERN.test(title) &&
    EXPLICIT_KOREAN_NATIONAL_BODY_PATTERN.test(summaryLead) &&
    STRUCTURAL_GOVERNANCE_CUE_PATTERN.test(summaryLead) &&
    hasExplicitNonKoreanNationalBody(summary)
  );
}

function hasDomesticCoachProcessBridge(title: string, summary: string): boolean {
  const hasVisibleKfaSummary =
    /(?:대한\s*축구협회|\bKFA\b)/iu.test(summary) &&
    !EXPLICIT_NON_FOOTBALL_KFA_IDENTITY_PATTERN.test(summary);

  return splitEvidenceSegments(normalizeHeadlineEllipses(title)).some(
    (segment) =>
      COACH_PROCESS_CUE_PATTERN.test(segment) &&
      (hasKfaAbbreviationContext(segment) ||
        (/홍명보/u.test(segment) && hasVisibleKfaSummary))
  );
}

function hasBareKfaStructuralGovernanceContext(text: string): boolean {
  return splitEvidenceSegments(text).some(
    (segment) =>
      hasKfaAbbreviationContext(segment) &&
      STRUCTURAL_GOVERNANCE_CUE_PATTERN.test(segment) &&
      /(?:축구|football)/iu.test(segment)
  );
}

function hasExplicitNonFootballBody(text: string): boolean {
  return splitEvidenceSegments(text).some((segment) =>
    EXPLICIT_NON_FOOTBALL_BODY_PATTERN.test(segment)
  );
}

function hasUnrelatedNonFootballTitleBranch(title: string): boolean {
  const segments = splitEvidenceSegments(title);
  return (
    segments.some((segment) => EXPLICIT_FOOTBALL_TITLE_PATTERN.test(segment)) &&
    segments.some((segment) => EXPLICIT_NON_FOOTBALL_BODY_PATTERN.test(segment)) &&
    !segments.some(
      (segment) =>
        EXPLICIT_FOOTBALL_TITLE_PATTERN.test(segment) &&
        (hasKfaAccountabilityContext(segment) ||
          hasNationalAssociationGovernanceContext(segment) ||
          COACH_PROCESS_CUE_PATTERN.test(segment))
    )
  );
}

function hasStrongDomesticCoachSummaryEvidence(
  title: string,
  summary: string
): boolean {
  const summaryLead = getSummaryLead(summary);
  const isHistoricalForeignDestination =
    !/(?:한국|대한민국)/u.test(title) &&
    /(?:후보로도?\s*거론됐던|후보였던)/u.test(summaryLead) &&
    /(?:중동행|해외행|이적|결국.{0,25}(?:선택|부임|떠나))/u.test(
      `${title} ${summaryLead}`
    );
  return (
    (!isHistoricalForeignDestination &&
      DOMESTIC_COACH_SUMMARY_PATTERN.test(summaryLead)) ||
    (KOREAN_COACH_APPOINTMENT_CONTEXT_PATTERN.test(
      normalizeHeadlineEllipses(title)
    ) &&
      /(?:러브콜|지원|후보|후임|차기|새\s*사령탑|고심)/u.test(title))
  );
}

function hasStrongDomesticStructuralSummaryEvidence(
  title: string,
  summary: string
): boolean {
  const hasTitleBridge =
    /(?:축구협회장?|한국\s*축구|한국축구|대한민국\s*축구|축구계)/u.test(
      normalizeHeadlineEllipses(title)
    );
  return (
    hasTitleBridge &&
    splitEvidenceSegments(summary).some(
      (segment) =>
        EXPLICIT_KOREAN_NATIONAL_BODY_PATTERN.test(segment) &&
        STRUCTURAL_GOVERNANCE_CUE_PATTERN.test(segment)
    )
  );
}

function hasStrongDomesticAuditSummaryEvidence(summary: string): boolean {
  return (
    hasKoreanFootballContext(summary) &&
    splitEvidenceSegments(summary).some(
      (segment) =>
        /(?:문체부|문화체육관광부)/u.test(segment) &&
        /(?:협회\s*감사|감사.{0,35}(?:회장|관계자|징계|자격정지))/u.test(
          segment
        )
    )
  );
}

function hasDomesticAssociationLeadBridge(
  title: string,
  summary: string,
  classification: NewsCandidateClassification
): boolean {
  const summaryLead = getSummaryLead(summary);
  return (
    /대한\s*축구\s*협회/u.test(summaryLead) &&
    ((classification.titlePersonTags?.length ?? 0) > 0 ||
      /(?:회장\s*선거|선거인단|정관|집행부|개혁|혁신|리더십)/u.test(
        `${title} ${summaryLead}`
      ))
  );
}

function hasTrackedLocalGovernanceHeadline(
  title: string,
  classification: NewsCandidateClassification
): boolean {
  const titlePersonKeywords = (
    classification.titleMatchedKeywords ?? classification.matchedKeywords
  ).filter(looksLikePersonKeyword);

  return (
    (classification.titlePersonTags?.length ?? 0) > 0 &&
    (classification.titleIssueTags?.length ?? 0) > 0 &&
    splitEvidenceSegments(title).some(
      (segment) =>
        hasLocalFootballAssociationContext(segment) &&
        titlePersonKeywords.some((keyword) =>
          textIncludesKeyword(segment, keyword)
        )
    ) &&
    DIRECT_NATIONAL_GOVERNANCE_CUE_PATTERN.test(
      normalizeHeadlineEllipses(title)
    )
  );
}

function hasFootballHearingBridge(
  title: string,
  summary: string,
  classification: NewsCandidateClassification
): boolean {
  return (
    /청문회/u.test(title) &&
    /(?:손흥민|황희찬|태극전사|축구|대표팀)/u.test(title) &&
    (/(?:대한\s*축구\s*협회|축구협회|\bKFA\b)/iu.test(summary) ||
      (classification.summaryPersonTags?.length ?? 0) > 0 ||
      classification.issueTags.includes("kfa-executives"))
  );
}

function hasDirectNationalGovernanceHeadline(title: string): boolean {
  return splitEvidenceSegments(normalizeHeadlineEllipses(title)).some(
    (segment) =>
      !hasLivestockCooperativeContext(segment) &&
      !hasLocalFootballAssociationContext(segment) &&
      (hasKfaAbbreviationContext(segment) ||
        hasAbbreviatedAssociationContext(segment) ||
        /축협/u.test(segment) ||
        /(?:대한\s*축구\s*협회|한국\s*축구|한국축구|대한민국\s*축구)/u.test(
          segment
        )) &&
      DIRECT_NATIONAL_GOVERNANCE_CUE_PATTERN.test(segment)
  );
}

function hasLocalActorNationalGovernanceEvidence(
  title: string,
  summary: string,
  classification: NewsCandidateClassification
): boolean {
  const text = `${title} ${summary}`;
  const hasLocalBody =
    hasLocalFootballAssociationContext(title) ||
    hasNamedLocalLivestockCooperativeContext(title);
  const titlePersonKeywords = (
    classification.titleMatchedKeywords ?? classification.matchedKeywords
  ).filter(looksLikePersonKeyword);
  const hasSameSegmentLocalActor = splitEvidenceSegments(title).some(
    (segment) =>
      (hasLocalFootballAssociationContext(segment) ||
        hasNamedLocalLivestockCooperativeContext(segment)) &&
      titlePersonKeywords.some((keyword) =>
        textIncludesKeyword(segment, keyword)
      )
  );
  return (
    hasLocalBody &&
    (classification.titlePersonTags?.length ?? 0) > 0 &&
    (LOCAL_ACTOR_NATIONAL_GOVERNANCE_PATTERN.test(title) ||
      (hasSameSegmentLocalActor &&
        /(?:축구협회|혁신위원회|K-?\s*축구\s*혁신|축구\s*혁신)/u.test(text) &&
        /(?:정몽규|박지성|이영표|홍명보|이임생|서강일)/u.test(title)))
  );
}

function hasNationalAssociationGovernanceContext(text: string): boolean {
  return splitEvidenceSegments(text).some(isNationalAssociationGovernanceSegment);
}

function hasNationalAssociationGovernanceHeadlineContext(title: string): boolean {
  return splitEvidenceSegments(normalizeHeadlineEllipses(title)).some(
    isNationalAssociationGovernanceSegment
  );
}

function hasKoreanFootballContext(text: string): boolean {
  return splitEvidenceSegments(text).some(
    (segment) => {
      if (
        hasExplicitNonKoreanNationalBody(segment) &&
        !EXPLICIT_KOREAN_NATIONAL_BODY_PATTERN.test(segment) &&
        !hasKfaAbbreviationContext(segment)
      ) {
        return false;
      }

      return (
        KOREAN_FOOTBALL_CONTEXT_KEYWORDS.some((keyword) =>
          segment.includes(keyword)
        ) ||
        hasKfaAbbreviationContext(segment) ||
        hasAbbreviatedAssociationContext(segment) ||
        hasNationalAssociationGovernanceContext(segment) ||
        KOREAN_COACH_APPOINTMENT_CONTEXT_PATTERN.test(segment) ||
        KOREAN_COACH_REPLACEMENT_CONTEXT_PATTERN.test(segment)
      );
    }
  );
}

function hasForeignFootballContext(text: string): boolean {
  return (
    FOREIGN_FOOTBALL_CONTEXT_PATTERNS.some((pattern) => pattern.test(text)) ||
    hasExplicitNonKoreanNationalBody(text)
  );
}

function hasStrongKfaAuditContext(text: string): boolean {
  return splitEvidenceSegments(text).some(
    (segment) =>
      STRONG_KFA_AUDIT_CONTEXT_KEYWORDS.some((keyword) =>
        segment.includes(keyword)
      ) ||
      (hasKfaAbbreviationContext(segment) &&
        EXPLICIT_AUDIT_CONTEXT_PATTERN.test(segment))
  );
}

function hasTrackedGovernanceContext(text: string): boolean {
  return TRACKED_GOVERNANCE_CONTEXT_KEYWORDS.some((keyword) => text.includes(keyword));
}

function hasKfaAccountabilityContext(text: string): boolean {
  return splitEvidenceSegments(text).some((segment) => {
    if (EXPLICIT_NON_FOOTBALL_KFA_IDENTITY_PATTERN.test(segment)) {
      return false;
    }
    if (hasLivestockCooperativeContext(segment)) {
      return false;
    }
    if (
      hasExplicitNonKoreanNationalBody(segment) &&
      !EXPLICIT_KOREAN_NATIONAL_BODY_PATTERN.test(segment) &&
      !hasDomesticKfaComparisonContext(segment)
    ) {
      return false;
    }
    if (
      GRATITUDE_CONTEXT_PATTERNS.some((pattern) => pattern.test(segment)) &&
      !EXPLICIT_AUDIT_CONTEXT_PATTERN.test(segment)
    ) {
      return false;
    }
    if (
      /\bKFA\b/iu.test(segment) &&
      NON_FOOTBALL_KFA_CONTEXT_PATTERN.test(segment)
    ) {
      return false;
    }

    return (
      KFA_ACCOUNTABILITY_CONTEXT_PATTERNS.some((pattern) => pattern.test(segment)) ||
      hasNationalAssociationGovernanceContext(segment) ||
      (hasKfaAbbreviationContext(segment) &&
        /(?:청문회|감사\s*(?:착수|결과|발표|보고서|처분|지적|후속)|조사|해명|사퇴|징계|소송|가처분|이사회|집행부|전력강화위원|감독\s*선임|선임\s*절차|제도\s*개편|거버넌스|혁신|쇄신|책임|논란|비판|후원|출연금|재정|참관단|출장비|National\s+Assembly|parliamentary|hearing|presidential\s+election|election\s+deadline|football\s+reform)/iu.test(
          segment
        ))
    );
  });
}

function hasKfaAccountabilityHeadlineContext(title: string): boolean {
  return hasKfaAccountabilityContext(normalizeHeadlineEllipses(title));
}

function hasExplicitAssociationGovernanceContext(text: string): boolean {
  return splitEvidenceSegments(text).some(
    (segment) =>
      hasNationalAssociationGovernanceContext(segment) ||
      (hasKfaAbbreviationContext(segment) &&
        KFA_GOVERNANCE_CUE_PATTERN.test(segment)) ||
      (hasAbbreviatedAssociationContext(segment) &&
        /(?:국회|국회의원|문체위|청문회|책임|비판|개혁|쇄신|정치|카르텔|밀실|부패|비리|무너|권력|실세|폭로|저격|회유|사유화|독점|해산|임원진|후원|출연금|재정|참관단|출장비)/u.test(
          segment
        ))
  );
}

function hasExplicitKoreanNationalAssociationGovernanceContext(
  text: string
): boolean {
  return splitEvidenceSegments(text).some(
    (segment) =>
      EXPLICIT_KOREAN_NATIONAL_BODY_PATTERN.test(segment) &&
      (NATIONAL_ASSOCIATION_GOVERNANCE_PATTERN.test(segment) ||
        KFA_GOVERNANCE_CUE_PATTERN.test(segment))
  );
}

function hasPersonGovernanceContext(text: string): boolean {
  return splitEvidenceSegments(text).some((segment) => {
    const nonAuditPatterns = PERSON_GOVERNANCE_CONTEXT_PATTERNS.slice(0, -1);
    return (
      nonAuditPatterns.some((pattern) => pattern.test(segment)) ||
      (EXPLICIT_AUDIT_CONTEXT_PATTERN.test(segment) &&
        !GRATITUDE_CONTEXT_PATTERNS.some((pattern) => pattern.test(segment)))
    );
  });
}

function hasStrongPersonIssueKeyword(
  classification: NewsCandidateClassification
): boolean {
  return classification.matchedKeywords.some((keyword) =>
    STRONG_PERSON_ISSUE_KEYWORDS.has(keyword)
  );
}

function hasLocalCompetitionResultContext(text: string): boolean {
  return (
    LOCAL_COMPETITION_CONTEXT_PATTERNS.some((pattern) => pattern.test(text)) &&
    COMPETITION_RESULT_PATTERNS.some((pattern) => pattern.test(text))
  );
}

function hasLowValuePerformanceContext(text: string): boolean {
  return LOW_VALUE_PERFORMANCE_CONTEXT_PATTERNS.every((pattern) => pattern.test(text));
}

function hasListingTitle(title: string): boolean {
  return LISTING_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

function hasAthleteRosterOrProfileContext(text: string): boolean {
  return ATHLETE_ROSTER_OR_PROFILE_PATTERNS.some((pattern) => pattern.test(text));
}

function hasPoliticalAnalogyContext(text: string): boolean {
  return POLITICAL_ANALOGY_CONTEXT_PATTERNS.some((pattern) => pattern.test(text));
}

function textIncludesKeyword(text: string, keyword: string): boolean {
  return text
    .toLocaleLowerCase("ko-KR")
    .includes(keyword.toLocaleLowerCase("ko-KR"));
}

function getFieldMatchedKeywords({
  fieldText,
  explicitKeywords,
  classification
}: {
  fieldText: string;
  explicitKeywords?: string[];
  classification: NewsCandidateClassification;
}): string[] {
  return (explicitKeywords ?? classification.matchedKeywords).filter((keyword) =>
    textIncludesKeyword(fieldText, keyword)
  );
}

function looksLikePersonKeyword(keyword: string): boolean {
  const compact = keyword.replace(/\s+/g, "");
  return (
    /^[가-힣]{2,8}$/u.test(compact) &&
    !/(?:축구|협회|감독|사령탑|선임|후보|후임|차기|위원|선거|선출|출마|지원|도전|복귀|감사|해명|사퇴|정관|지도자|유소년|거버넌스|육성|시스템|제도|규정|조사|결과|혁신|개혁|책임|논란|비판|반발|발언|청문회)/u.test(
      compact
    )
  );
}

function hasTitlePersonEvidence(
  title: string,
  classification: NewsCandidateClassification
): boolean {
  if (classification.titlePersonTags) {
    return classification.titlePersonTags.length > 0;
  }

  if (classification.personTags.length === 0) {
    return false;
  }

  return getFieldMatchedKeywords({
    fieldText: title,
    classification
  }).some(looksLikePersonKeyword);
}

function hasSummaryPersonEvidence(
  summary: string,
  classification: NewsCandidateClassification
): boolean {
  if (
    (classification.summaryPersonTags ?? classification.personTags).length === 0
  ) {
    return false;
  }

  return getFieldMatchedKeywords({
    fieldText: summary,
    explicitKeywords: classification.summaryMatchedKeywords,
    classification
  }).some(looksLikePersonKeyword);
}

function hasStrongTitleSubject(
  title: string,
  classification: NewsCandidateClassification
): boolean {
  return (
    STRONG_TITLE_SUBJECT_PATTERNS.some((pattern) => pattern.test(title)) ||
    KOREAN_COACH_APPOINTMENT_CONTEXT_PATTERN.test(title) ||
    KOREAN_COACH_REPLACEMENT_CONTEXT_PATTERN.test(title) ||
    hasKfaAbbreviationContext(title) ||
    hasAbbreviatedAssociationContext(title) ||
    hasNationalAssociationGovernanceHeadlineContext(title) ||
    hasTitlePersonEvidence(title, classification)
  );
}

function getSummaryLead(summary: string): string {
  return (splitEvidenceSegments(summary)[0] ?? "").slice(0, 100);
}

function hasStrongSummaryEvidence(
  summary: string,
  classification: NewsCandidateClassification
): boolean {
  const hasSegmentEvidence = splitEvidenceSegments(summary).some((segment) => {
    const segmentClassification: NewsCandidateClassification = {
      ...classification,
      matchedKeywords: getFieldMatchedKeywords({
        fieldText: segment,
        classification
      })
    };
    return (
      hasExplicitAssociationGovernanceContext(segment) ||
      (hasKoreanFootballContext(segment) &&
        hasPersonGovernanceInSameSegment(segment, segmentClassification)) ||
      (hasSummaryPersonEvidence(segment, segmentClassification) &&
        hasPersonGovernanceContext(segment))
    );
  });

  if (hasSegmentEvidence) {
    return true;
  }

  return (
    classification.issueTags.length > 0 &&
    hasKoreanFootballContext(summary) &&
    SUMMARY_KFA_IMPACT_PATTERN.test(summary)
  );
}

function hasRelatedIssueEvidenceInTitle(
  title: string,
  classification: NewsCandidateClassification
): boolean {
  return hasRelatedIssueEvidenceInSegments(
    normalizeHeadlineEllipses(title),
    classification
  );
}

function hasRelatedIssueEvidenceInSegments(
  text: string,
  classification: NewsCandidateClassification
): boolean {
  return splitEvidenceSegments(text).some((segment) => {
    const segmentKeywords = getFieldMatchedKeywords({
      fieldText: segment,
      classification
    });
    const segmentClassification: NewsCandidateClassification = {
      ...classification,
      matchedKeywords: segmentKeywords
    };
    const hasNonSubjectEvidence = segmentKeywords.some(
      (keyword) =>
        !/^(?:대한\s*축구협회|대한\s*축구협회장|축구협회|축구협회장|축협|KFA|한국\s*축구|한국축구|대한민국\s*축구)$/iu.test(
          keyword
        ) && !looksLikePersonKeyword(keyword)
    );

    return (
      hasKfaAccountabilityContext(segment) ||
      hasNationalAssociationGovernanceContext(segment) ||
      (hasNonSubjectEvidence &&
        hasRelatedFieldContext(segment, segmentClassification))
    );
  });
}

function hasRelatedPersonEvidenceInTitle(
  title: string,
  classification: NewsCandidateClassification
): boolean {
  return splitEvidenceSegments(normalizeHeadlineEllipses(title)).some((segment) => {
    const segmentClassification: NewsCandidateClassification = {
      ...classification,
      matchedKeywords: getFieldMatchedKeywords({
        fieldText: segment,
        classification
      })
    };
    return hasPersonGovernanceInSameSegment(segment, segmentClassification);
  });
}

function hasBundledNewsTitle(title: string): boolean {
  return BUNDLED_NEWS_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

function hasGratitudeContext(text: string): boolean {
  return GRATITUDE_CONTEXT_PATTERNS.some((pattern) => pattern.test(text));
}

function hasOnlyBroadAuditAndGenericAssociationKeywords(
  classification: NewsCandidateClassification
): boolean {
  return (
    classification.matchedKeywords.length > 0 &&
    classification.matchedKeywords.every(
      (keyword) =>
        BROAD_AUDIT_KEYWORDS.has(keyword) || GENERIC_ASSOCIATION_KEYWORDS.has(keyword)
    )
  );
}

function hasPersonGovernanceInSameSegment(
  text: string,
  classification: NewsCandidateClassification
): boolean {
  const personKeywords = classification.matchedKeywords.filter(looksLikePersonKeyword);
  if (personKeywords.length === 0) {
    return false;
  }

  return splitEvidenceSegments(text).some(
    (segment) =>
      personKeywords.some((keyword) => textIncludesKeyword(segment, keyword)) &&
      (hasTrackedGovernanceContext(segment) ||
        hasKfaAccountabilityContext(segment) ||
        hasPersonGovernanceContext(segment) ||
        classification.matchedKeywords.some(
          (keyword) =>
            STRONG_PERSON_ISSUE_KEYWORDS.has(keyword) &&
            textIncludesKeyword(segment, keyword)
        ))
  );
}

function hasRelatedFieldContext(
  text: string,
  classification: NewsCandidateClassification
): boolean {
  return (
    hasKfaAccountabilityContext(text) ||
    hasNationalAssociationGovernanceContext(text) ||
    (hasKoreanFootballContext(text) &&
      (classification.issueTags.length > 0 ||
        hasTrackedGovernanceContext(text) ||
        hasPersonGovernanceContext(text))) ||
    hasPersonGovernanceInSameSegment(text, classification)
  );
}

function hasRelatedPrimaryPersonEvidence({
  title,
  classification,
  titleClassification
}: {
  title: string;
  classification: NewsCandidateClassification;
  titleClassification: NewsCandidateClassification;
}): boolean {
  if (classification.titlePersonTags === undefined) {
    return true;
  }

  return hasRelatedPersonEvidenceInTitle(title, titleClassification);
}

function hasRelatedPrimaryIssueEvidence({
  classification,
  title,
  titleClassification
}: {
  classification: NewsCandidateClassification;
  title: string;
  titleClassification: NewsCandidateClassification;
}): boolean {
  if (classification.titleIssueTags === undefined) {
    return true;
  }

  return (
    (titleClassification.issueTags.length > 0 &&
      hasRelatedIssueEvidenceInTitle(title, titleClassification))
  );
}

function scopeClassificationToField(
  classification: NewsCandidateClassification,
  location: "title" | "summary",
  fieldText: string
): NewsCandidateClassification {
  const issueTags =
    location === "title"
      ? classification.titleIssueTags
      : classification.summaryIssueTags;
  const personTags =
    location === "title"
      ? classification.titlePersonTags
      : classification.summaryPersonTags;
  const matchedKeywords =
    location === "title"
      ? classification.titleMatchedKeywords
      : classification.summaryMatchedKeywords;
  const relevanceScore =
    location === "title"
      ? classification.titleRelevanceScore
      : classification.summaryRelevanceScore;

  return {
    issueTags: issueTags ?? classification.issueTags,
    personTags: personTags ?? classification.personTags,
    matchedKeywords:
      matchedKeywords ??
      classification.matchedKeywords.filter((keyword) =>
        textIncludesKeyword(fieldText, keyword)
      ),
    relevanceScore: relevanceScore ?? classification.relevanceScore
  };
}

function hasPrimaryPersonContext({
  text,
  classification
}: {
  text: string;
  classification: NewsCandidateClassification;
}): boolean {
  return (
    classification.personTags.length > 0 &&
    (hasTrackedGovernanceContext(text) ||
      hasKfaAccountabilityContext(text) ||
      hasPersonGovernanceContext(text) ||
      hasStrongPersonIssueKeyword(classification))
  );
}

function hasPrimaryIssueContext({
  text,
  classification
}: {
  text: string;
  classification: NewsCandidateClassification;
}): boolean {
  if (classification.issueTags.length === 0) {
    return false;
  }

  const hasOnlyGenericAssociationKeywords =
    classification.matchedKeywords.length > 0 &&
    classification.matchedKeywords.every((keyword) =>
      GENERIC_ASSOCIATION_KEYWORDS.has(keyword)
    );

  if (hasOnlyGenericAssociationKeywords) {
    return false;
  }

  if (
    classification.issueTags.includes("mcst-audit") &&
    hasOnlyBroadAuditAndGenericAssociationKeywords(classification) &&
    !hasStrongKfaAuditContext(text)
  ) {
    return false;
  }

  return (
    hasKoreanFootballContext(text) &&
    classification.relevanceScore >= 20
  );
}

function hasFieldLocalPersonEvidence(
  classification: NewsCandidateClassification
): boolean {
  if (
    classification.titlePersonTags === undefined &&
    classification.summaryPersonTags === undefined
  ) {
    return classification.personTags.length > 0;
  }

  return (
    (classification.titlePersonTags?.length ?? 0) > 0 ||
    (classification.summaryPersonTags?.length ?? 0) > 0
  );
}

function hasSecondaryCollectionContext({
  text,
  classification
}: {
  text: string;
  classification: NewsCandidateClassification;
}): boolean {
  if (!text.trim()) {
    return false;
  }

  if (hasBareKfaStructuralGovernanceContext(text)) {
    return true;
  }

  if (hasFieldLocalPersonEvidence(classification)) {
    return (
      hasKoreanFootballContext(text) ||
      hasTrackedGovernanceContext(text) ||
      hasKfaAccountabilityContext(text) ||
      hasPersonGovernanceContext(text) ||
      hasStrongPersonIssueKeyword(classification)
    );
  }

  if (classification.issueTags.length > 0) {
    return hasRelatedIssueEvidenceInSegments(text, classification);
  }

  return (
    classification.relevanceScore >= 20 &&
    classification.matchedKeywords.some((keyword) =>
      FOOTBALL_CONTEXT_KEYWORDS.includes(keyword)
    )
  );
}

export function getNewsCandidateRelevanceTier({
  title,
  summary,
  classification
}: NewsCandidateInput): NewsCandidateRelevanceTier {
  const text = `${title ?? ""} ${summary ?? ""}`;
  const titleText = title ?? "";
  const summaryText = summary ?? "";
  const titleClassification = scopeClassificationToField(
    classification,
    "title",
    titleText
  );
  const summaryClassification = scopeClassificationToField(
    classification,
    "summary",
    summaryText
  );
  const hasGovernanceContext =
    hasTrackedGovernanceContext(text) ||
    hasKfaAccountabilityContext(text) ||
    hasPersonGovernanceContext(text);

  const summaryLead = getSummaryLead(summary ?? "");
  const titleLead = splitEvidenceSegments(titleText)[0] ?? "";
  const hasDomesticStructuralComparison =
    hasDomesticStructuralComparisonContext(titleText, summaryText);
  const hasDomesticForeignComparison =
    hasDomesticStructuralComparison ||
    hasDomesticKfaComparisonContext(text) ||
    (EXPLICIT_KOREAN_NATIONAL_BODY_PATTERN.test(titleLead) &&
      COMPARISON_CUE_PATTERN.test(titleLead));
  const hasDomesticCoachProcess = hasDomesticCoachProcessBridge(
    titleText,
    summaryText
  );
  const hasStrongDomesticCoachSummary =
    hasStrongDomesticCoachSummaryEvidence(titleText, summaryText);
  const hasStrongDomesticStructuralSummary =
    hasStrongDomesticStructuralSummaryEvidence(titleText, summaryText);
  const hasStrongDomesticAuditSummary =
    hasStrongDomesticAuditSummaryEvidence(summaryText);
  const hasDomesticAssociationLead = hasDomesticAssociationLeadBridge(
    titleText,
    summaryText,
    classification
  );
  const hasTrackedLocalGovernance = hasTrackedLocalGovernanceHeadline(
    titleText,
    classification
  );
  const hasFootballHearing = hasFootballHearingBridge(
    titleText,
    summaryText,
    classification
  );
  const hasLocalActorNationalGovernance =
    hasLocalActorNationalGovernanceEvidence(
      titleText,
      summaryText,
      classification
    );
  const hasTrackedNationalGovernanceLead =
    (classification.titlePersonTags?.length ?? 0) > 0 &&
    (classification.titleIssueTags?.length ?? 0) > 0 &&
    hasNationalAssociationGovernanceContext(titleLead);
  if (
    EXPLICIT_NON_FOOTBALL_KFA_IDENTITY_PATTERN.test(text) &&
    !hasExplicitDomesticKfaIdentity(text)
  ) {
    return "reject";
  }
  if (
    AGRICULTURAL_COOPERATIVE_TITLE_PATTERN.test(titleText) &&
    !EXPLICIT_FOOTBALL_TITLE_PATTERN.test(titleText)
  ) {
    return "reject";
  }
  if (
    (NON_FOOTBALL_SPORT_CONTEXT_PATTERN.test(titleText) ||
      hasExplicitNonFootballBody(summaryText)) &&
    !EXPLICIT_FOOTBALL_TITLE_PATTERN.test(titleText) &&
    !hasDomesticAssociationLead &&
    !hasFootballHearing
  ) {
    return "reject";
  }

  if (
    (hasNonFootballNationalTeamCoachContext(titleText) ||
      hasNonFootballNationalTeamCoachContext(summaryText)) &&
    !hasDomesticAssociationLead &&
    !hasFootballHearing
  ) {
    return "reject";
  }

  if (hasUnrelatedNonFootballTitleBranch(titleText)) {
    return "reject";
  }

  if (
    hasFieldScopedLivestockCooperativeContext(titleText, summaryText) &&
    !hasLocalActorNationalGovernance &&
    !/(?:대한\s*축구협회|한국\s*축구|한국축구|대한민국\s*축구|K리그)/u.test(
      titleText
    )
  ) {
    return "reject";
  }

  if (hasListingTitle(titleText) && !hasKfaAccountabilityContext(titleText)) {
    return "reject";
  }

  if (hasBundledNewsTitle(titleText)) {
    return "reject";
  }

  if (hasGratitudeContext(text) && !hasGovernanceContext) {
    return "reject";
  }

  if (
    hasExplicitNonKoreanNationalBody(titleText) &&
    !KOREAN_COACH_APPOINTMENT_CONTEXT_PATTERN.test(titleText) &&
    !KOREAN_COACH_REPLACEMENT_CONTEXT_PATTERN.test(titleText) &&
    !hasDomesticCoachProcess &&
    !hasDomesticForeignComparison
  ) {
    return "reject";
  }

  if (
    hasExplicitNonKoreanNationalBody(summaryText) &&
    !KOREAN_COACH_APPOINTMENT_CONTEXT_PATTERN.test(titleText) &&
    !KOREAN_COACH_REPLACEMENT_CONTEXT_PATTERN.test(titleText) &&
    !hasDomesticCoachProcess &&
    !hasStrongDomesticCoachSummary &&
    !hasDomesticForeignComparison
  ) {
    return "reject";
  }

  if (
    FOREIGN_CLUB_COACH_CONTEXT_PATTERN.test(titleText) &&
    !KOREAN_COACH_APPOINTMENT_CONTEXT_PATTERN.test(titleText) &&
    !hasDomesticCoachProcess
  ) {
    return "reject";
  }

  if (text && hasForeignFootballContext(text) && !hasKoreanFootballContext(text)) {
    return "reject";
  }

  if (
    hasLocalFootballAssociationContext(titleText) &&
    !NATIONAL_GOVERNANCE_BRIDGE_PATTERN.test(titleText) &&
    !hasExplicitKoreanNationalAssociationGovernanceContext(summaryText) &&
    !LOCAL_ACTOR_NATIONAL_GOVERNANCE_PATTERN.test(titleText) &&
    !hasLocalActorNationalGovernance &&
    !hasTrackedLocalGovernance &&
    !hasTrackedNationalGovernanceLead
  ) {
    return "reject";
  }

  if (
    hasLocalFootballAssociationContext(summaryText) &&
    /(?:축구협회|축구협회장)/u.test(titleText) &&
    !hasExplicitDomesticKfaIdentity(text) &&
    !NATIONAL_GOVERNANCE_BRIDGE_PATTERN.test(titleText) &&
    !hasExplicitKoreanNationalAssociationGovernanceContext(summaryText) &&
    !LOCAL_ACTOR_NATIONAL_GOVERNANCE_PATTERN.test(titleText) &&
    !hasLocalActorNationalGovernance &&
    !hasTrackedLocalGovernance
  ) {
    // A named local association in the summary resolves a bare
    // `축구협회` headline to that local body. Keep only an independently
    // explicit or tracked national-governance signal; otherwise the headline
    // must not borrow KFA relevance from generic election or charter wording.
    return "reject";
  }

  if (hasAthleteRosterOrProfileContext(text) && !hasGovernanceContext) {
    return "reject";
  }

  if (
    hasPoliticalAnalogyContext(text) &&
    !hasExplicitAssociationGovernanceContext(text) &&
    !hasStrongDomesticAuditSummary
  ) {
    return "reject";
  }

  if (hasLocalCompetitionResultContext(text) && !hasTrackedGovernanceContext(text)) {
    return "reject";
  }

  const hasExplicitPerformanceGovernanceContext =
    hasTrackedGovernanceContext(titleText) ||
    hasKfaAccountabilityHeadlineContext(titleText) ||
    hasNationalAssociationGovernanceHeadlineContext(titleText) ||
    hasBareKfaStructuralGovernanceContext(titleText) ||
    hasPersonGovernanceInSameSegment(titleText, titleClassification);
  if (
    hasLowValuePerformanceContext(`${titleText} ${summaryLead}`) &&
    !hasExplicitPerformanceGovernanceContext
  ) {
    return hasExplicitAssociationGovernanceContext(summaryText)
      ? "secondary"
      : "reject";
  }

  if (
    classification.issueTags.includes("mcst-audit") &&
    hasOnlyBroadAuditAndGenericAssociationKeywords(classification) &&
    !hasStrongKfaAuditContext(text) &&
    !hasStrongDomesticAuditSummary
  ) {
    return "reject";
  }

  if (hasDirectNationalGovernanceHeadline(titleText)) {
    return "primary";
  }

  const hasTitleSubject = hasStrongTitleSubject(titleText, titleClassification);
  if (!hasTitleSubject) {
    return hasDomesticStructuralComparison ||
      hasFootballHearing ||
      hasStrongDomesticCoachSummary ||
      hasStrongDomesticStructuralSummary ||
      hasStrongDomesticAuditSummary ||
      hasDomesticAssociationLead ||
      hasLocalActorNationalGovernance ||
      hasStrongSummaryEvidence(summaryText, summaryClassification) ||
      (titleText.includes("청문회") &&
        (hasKfaAccountabilityHeadlineContext(titleText) ||
          hasNationalAssociationGovernanceHeadlineContext(titleText) ||
          hasExplicitAssociationGovernanceContext(text) ||
          (hasFieldLocalPersonEvidence(classification) &&
            /(?:대한\s*축구협회|축구협회|축협|\bKFA\b)/iu.test(text) &&
            !NON_FOOTBALL_KFA_CONTEXT_PATTERN.test(text))))
      ? "secondary"
      : "reject";
  }

  if (OPERATIONAL_OFFICIATING_CONTEXT_PATTERN.test(titleText)) {
    return hasSecondaryCollectionContext({ text, classification })
      ? "secondary"
      : "reject";
  }

  if (
    hasPrimaryPersonContext({
      text,
      classification
    }) &&
    hasRelatedPrimaryPersonEvidence({
      title: titleText,
      classification,
      titleClassification
    })
  ) {
    return "primary";
  }

  if (
    hasKfaAccountabilityHeadlineContext(titleText) &&
    titleClassification.relevanceScore > 0
  ) {
    return "primary";
  }

  if (
    hasPrimaryIssueContext({
      text,
      classification
    }) &&
    hasRelatedPrimaryIssueEvidence({
      classification,
      title: titleText,
      titleClassification
    })
  ) {
    return "primary";
  }

  if (
    hasSecondaryCollectionContext({
      text,
      classification
    }) ||
    hasDomesticStructuralComparison ||
    hasFootballHearing ||
    hasStrongDomesticCoachSummary ||
    hasStrongDomesticStructuralSummary ||
    hasStrongDomesticAuditSummary ||
    hasDomesticAssociationLead ||
    hasLocalActorNationalGovernance ||
    hasStrongSummaryEvidence(summaryText, summaryClassification)
  ) {
    return "secondary";
  }

  return "reject";
}

export function shouldKeepNewsCandidate(input: NewsCandidateInput): boolean {
  return getNewsCandidateRelevanceTier(input) !== "reject";
}

export function filterNewsItemsForCollection(items: RadarItem[]): RadarItem[] {
  return items.filter(
    (item) => {
      if (item.sourceType !== "news") {
        return true;
      }

      return shouldKeepNewsCandidate({
        title: item.title,
        summary: item.summary,
        classification: item
      });
    }
  );
}

export function reclassifyAndFilterNewsItemsForCollection({
  items,
  issues,
  people
}: {
  items: RadarItem[];
  issues: Issue[];
  people: Person[];
}): RadarItem[] {
  return items.flatMap((item) => {
    if (item.sourceType !== "news") {
      return [item];
    }

    const classification = classifyItemText({
      title: item.title,
      summary: item.summary,
      issues,
      people,
      isOfficial: false
    });
    const relevanceTier = getNewsCandidateRelevanceTier({
      title: item.title,
      summary: item.summary,
      classification
    });

    if (relevanceTier === "reject") {
      return [];
    }

    return [
      {
        ...item,
        matchedKeywords: classification.matchedKeywords,
        issueTags: classification.issueTags,
        personTags: classification.personTags,
        relevanceScore: classification.relevanceScore,
        relevanceTier: relevanceTier === "secondary" ? "secondary" : undefined,
        labels: classification.labels
      }
    ];
  });
}

export function getNaverSearchQueries({
  issues,
  people
}: {
  issues: Issue[];
  people: Person[];
}): string[] {
  return getSearchQueries({ issues, people }).slice(0, MAX_NAVER_SEARCH_QUERIES);
}

export async function collectNaverNews({
  issues,
  people
}: {
  issues: Issue[];
  people: Person[];
}): Promise<RadarItem[]> {
  return (await collectNaverNewsRun({ issues, people })).items;
}

function getTitleSummaryOverlap(title: string, summary: string): number {
  const titleTokens = new Set(
    title
      .toLocaleLowerCase("ko-KR")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 2)
  );
  const summaryTokens = new Set(
    summary
      .toLocaleLowerCase("ko-KR")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 2)
  );

  return [...titleTokens].filter((token) => summaryTokens.has(token)).length;
}

function compareNaverObservations(
  previous: NaverNewsObservation,
  next: NaverNewsObservation
): number {
  const previousCompleteTitle = /(?:\.{3}|…)$/u.test(previous.title) ? 0 : 1;
  const nextCompleteTitle = /(?:\.{3}|…)$/u.test(next.title) ? 0 : 1;
  const qualityDifference =
    nextCompleteTitle - previousCompleteTitle ||
    getTitleSummaryOverlap(next.title, next.summary) -
      getTitleSummaryOverlap(previous.title, previous.summary) ||
    next.title.length - previous.title.length ||
    next.summary.length - previous.summary.length;

  if (qualityDifference !== 0) {
    return qualityDifference;
  }

  return `${previous.title}\n${previous.summary}`.localeCompare(
    `${next.title}\n${next.summary}`,
    "ko-KR"
  );
}

function selectNaverObservations(
  observations: NaverNewsObservation[]
): NaverNewsObservation[] {
  const byCanonicalUrl = new Map<string, NaverNewsObservation>();

  for (const observation of observations) {
    const canonicalUrl = canonicalizeUrl(observation.originalUrl);
    const previous = byCanonicalUrl.get(canonicalUrl);
    if (!previous) {
      byCanonicalUrl.set(canonicalUrl, {
        ...observation,
        originalUrl: canonicalUrl,
        queries: [...observation.queries]
      });
      continue;
    }

    const preferred =
      compareNaverObservations(previous, observation) > 0 ? observation : previous;
    byCanonicalUrl.set(canonicalUrl, {
      ...preferred,
      originalUrl: canonicalUrl,
      queries: Array.from(new Set([...previous.queries, ...observation.queries])).sort(
        (a, b) => a.localeCompare(b, "ko-KR")
      )
    });
  }

  return [...byCanonicalUrl.values()];
}

export async function collectNaverNewsRun({
  issues,
  people
}: {
  issues: Issue[];
  people: Person[];
}): Promise<CollectorRunResult> {
  const queries = getNaverSearchQueries({ issues, people });
  const queryDelayMs = getNaverQueryDelayMs();
  const collectedDate = new Date();
  const collectedAt = collectedDate.toISOString();
  const retentionDays = getItemRetentionDays();
  const observations: NaverNewsObservation[] = [];
  let succeeded = 0;
  let failed = 0;

  if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
    return { items: [], attempted: 1, succeeded: 0, failed: 1 };
  }

  for (const [index, query] of queries.entries()) {
    if (index > 0 && queryDelayMs > 0) {
      await wait(queryDelayMs);
    }

    try {
      const newsItems = await fetchNaverNews(query);
      succeeded += 1;
      for (const newsItem of newsItems) {
        const originalUrl = newsItem.originallink || newsItem.link;
        const publishedAt = toIsoDate(newsItem.pubDate);
        if (!publishedAt) {
          continue;
        }
        if (
          !isPublishedAtWithinRetention({
            publishedAt,
            now: collectedDate,
            retentionDays
          })
        ) {
          continue;
        }

        const title = stripInlineHtml(newsItem.title);
        const summary = truncateSummary(newsItem.description);
        observations.push({
          title,
          summary,
          originalUrl,
          publishedAt,
          queries: [query]
        });
      }
    } catch (error) {
      failed += 1;
      console.error(error instanceof Error ? error.message : error);
    }
  }

  const results = selectNaverObservations(observations).flatMap((observation) => {
    const classification = classifyItemText({
      title: observation.title,
      summary: observation.summary,
      issues,
      people,
      isOfficial: false
    });
    const relevanceTier = getNewsCandidateRelevanceTier({
      title: observation.title,
      summary: observation.summary,
      classification
    });

    if (relevanceTier === "reject") {
      return [];
    }

    return [
      {
        id: stableItemId(observation.originalUrl),
        type: "news" as const,
        title: observation.title,
        summary: observation.summary,
        url: observation.originalUrl,
        originalUrl: observation.originalUrl,
        publisher: normalizePublisher(observation.originalUrl),
        publishedAt: observation.publishedAt,
        collectedAt,
        matchedKeywords: classification.matchedKeywords,
        discoveryQueries: observation.queries,
        issueTags: classification.issueTags,
        personTags: classification.personTags,
        sourceType: "news" as const,
        isOfficial: false,
        relevanceScore: classification.relevanceScore,
        relevanceTier: relevanceTier === "secondary" ? ("secondary" as const) : undefined,
        labels: classification.labels
      }
    ];
  });

  return {
    items: dedupeItems(results),
    attempted: queries.length,
    succeeded,
    failed
  };
}

async function run(): Promise<void> {
  const [items, issues, people] = await Promise.all([readItems(), readIssues(), readPeople()]);
  const result = await collectNaverNewsRun({ issues, people });
  const update = await persistCollectionRun({
    existingItems: items,
    results: [result],
    filterItems: (candidateItems) =>
      reclassifyAndFilterNewsItemsForCollection({
        items: candidateItems,
        issues,
        people
      })
  });
  console.log(
    `Naver collector merged ${result.items.length} candidate items (${result.succeeded}/${result.attempted} queries succeeded, status ${update.state.lastRunStatus})`
  );
  if (update.state.lastRunStatus === "failed") {
    throw new Error("Naver collector did not complete any query");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
