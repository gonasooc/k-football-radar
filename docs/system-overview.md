# 전체 작동 구조

이 문서는 Korea Football Radar가 어떻게 데이터를 모으고, 저장하고, 화면에 보여주고, 배포되는지 설명한다. 코드를 처음 보는 사람도 전체 흐름을 잡을 수 있도록 작성했다.

## 1. 한 문장으로 보는 구조

Korea Football Radar는 외부 뉴스와 공식자료의 메타데이터를 GitHub Actions에서 수집하고, 그 결과를 `data/*.json` 파일로 커밋한 뒤, Next.js가 해당 JSON 파일을 읽어 화면을 만드는 프로젝트다.

```text
Naver News API / 공식 웹사이트
        ↓
GitHub Actions 수집 워크플로
        ↓
scripts/update-data.ts
        ↓
data/items/YYYY-MM-DD.json, data/collection-state.json
        ↓
Next.js App Router
        ↓
Vercel 배포 화면
```

중요한 점은 데이터베이스가 없다는 것이다. MVP에서는 Supabase, Redis, CMS 같은 외부 저장소를 쓰지 않는다. 수집된 결과는 저장소 안의 JSON 파일에 저장된다.

## 2. 주요 폴더 역할

```text
app/          화면 라우트
components/   화면을 구성하는 재사용 UI 컴포넌트
data/         앱이 읽는 JSON 데이터
lib/          데이터 읽기, 검증, 분류, 중복 제거, 통계 계산
scripts/      수집, 검증, 준비 상태 확인용 실행 스크립트
tests/        단위 테스트
docs/         기획서, 구조 설명, 잔여 작업 문서
.github/      GitHub Actions 워크플로
```

각 폴더는 역할이 명확히 나뉜다. 화면은 `app/`와 `components/`가 담당하고, 수집과 데이터 가공은 `scripts/`와 `lib/`가 담당한다.

## 3. 데이터 파일

앱이 실제로 읽는 핵심 데이터는 `data/` 아래에 있다.

```text
data/items/YYYY-MM-DD.json
data/people.json
data/issues.json
data/sources.json
data/collection-state.json
```

### `items/YYYY-MM-DD.json`

수집된 뉴스와 공식자료 목록이다. `publishedAt` 날짜 기준으로 하루 단위 JSON shard에 저장한다. 카드 하나에 필요한 제목, 짧은 설명, 출처, 원문 링크, 발행일, 수집일, 태그가 들어간다.

기사 본문 전체는 저장하지 않는다. 원문 확인은 `url` 또는 `originalUrl` 링크로 이동해서 한다.

### `people.json`

인물 목록이다. 인물 이름, 별칭, 검색 키워드, 관련 역할을 담는다. 수집기가 기사 제목과 설명에서 이 키워드를 찾으면 `personTags`를 붙인다.

### `issues.json`

추적할 이슈 목록이다. 예를 들어 회장 선거, 선거인단, 정관 개정 같은 주제를 정의한다. 각 이슈에는 매칭 키워드가 있고, 수집기가 이 키워드를 기준으로 `issueTags`를 붙인다.

### `sources.json`

수집 대상 출처 목록이다. Naver News API 같은 뉴스 API와 KFA, 문체부, 대한체육회 같은 공식자료 출처가 들어간다.

### `collection-state.json`

마지막 수집 시각, 마지막 실행 상태, 새로 들어온 항목 수, 전체 항목 수를 기록한다. 대시보드의 “최근 수집 시각” 같은 정보가 여기에서 나온다.

## 4. 화면이 데이터를 읽는 방식

Next.js 서버는 런타임에서 외부 수집 API를 직접 호출하지 않는다. 저장소의 JSON 파일을 읽어 첫 화면을 만들고, 브라우저의 검색·필터·더보기 요청은 같은 배포 안의 `/api/feed`가 JSON 데이터를 페이지 단위로 조회해 응답한다.

핵심 파일은 `lib/data.ts`다.

```text
data/*.json
   ↓
lib/data.ts
   ├─ app/page.tsx, app/issues/[id]/page.tsx, app/people/[id]/page.tsx
   └─ app/api/feed/route.ts → 30개 단위 후속 페이지
```

`lib/data.ts`는 JSON 파일을 읽은 뒤 zod 스키마로 구조를 검증한다. 잘못된 데이터가 있으면 빌드나 검증 단계에서 바로 실패한다.

## 5. 주요 화면

### `/`

검색 가능한 최신 피드와 최근 24시간 수집 통계를 보여준다. URL의 검색·필터 조건은 서버에서 첫 페이지에 반영되고, 이후 필터 변경과 더보기는 30개 단위 API 요청으로 처리한다.

### `/feed`

홈으로 이동하는 호환 경로다. 실제 피드와 필터 UI는 `/`와 `components/FeedClient.tsx`가 담당한다.

### `/issues`

이슈 목록이다. 각 이슈가 몇 개의 항목과 연결되어 있는지 보여준다.

### `/issues/[id]`

특정 이슈에 연결된 수집 항목만 보여준다.

### `/people`

인물 목록이다. 각 인물이 몇 개의 항목에서 언급됐는지 보여준다.

### `/people/[id]`

특정 인물이 언급된 수집 항목만 보여준다.

### `/sources`

수집 출처와 publisher 통계를 보여준다.

## 6. 수집 흐름

수집의 시작점은 `scripts/update-data.ts`다.

```text
scripts/update-data.ts
        ├─ scripts/collect-naver-news.ts
        ├─ scripts/collect-official.ts
        ├─ lib/classify.ts
        ├─ lib/dedupe.ts
        └─ scripts/data-io.ts
```

실행 명령은 다음과 같다.

```bash
pnpm run collect
```

로컬 `.env` 파일을 읽어서 테스트하려면 다음 명령을 사용한다.

```bash
pnpm run collect:local
```

### 1단계: 기존 데이터 읽기

`scripts/data-io.ts`가 `data/items/` 아래의 일별 shard와 `data/issues.json`, `data/people.json`, `data/sources.json`, `data/collection-state.json`을 읽는다.

### 2단계: Naver News API 수집

`scripts/collect-naver-news.ts`가 검색 쿼리를 만들고 Naver News Search API를 호출한다.

Naver API에는 다음 환경변수가 필요하다.

```text
NAVER_CLIENT_ID
NAVER_CLIENT_SECRET
```

이 값이 없으면 Naver 수집은 건너뛴다. 이렇게 해야 로컬 개발이나 CI에서 시크릿이 없더라도 전체 프로젝트가 바로 깨지지 않는다.

### 3단계: 공식자료 수집

`scripts/collect-official.ts`가 `sources.json`의 공식자료 출처를 읽고 HTML에서 링크를 추출한다.

공식 사이트는 구조가 자주 바뀔 수 있다. 그래서 하나의 공식자료 출처 fetch가 실패해도 전체 수집은 중단하지 않도록 되어 있다.

### 4단계: 분류

`lib/classify.ts`가 제목과 짧은 설명을 보고 이슈 태그, 인물 태그, 매칭 키워드, 관련도 점수를 계산한다.

분류는 키워드 기반이다. 그래서 화면에서도 자동 태그가 틀릴 수 있음을 전제로 원문 링크 확인을 유도한다.

### 5단계: 노이즈 필터링

Naver 검색은 넓은 키워드에서 엉뚱한 결과가 들어올 수 있다. 예를 들어 “감사” 같은 단어는 축구와 무관한 기사도 많이 가져온다.

그래서 Naver 후보는 축구 맥락이 약하거나 관련도 점수가 낮으면 저장하지 않는다. 인물 태그가 붙은 항목은 낮은 점수여도 보존한다.

### 6단계: 중복 제거

`lib/dedupe.ts`가 URL, 원문 URL, 제목과 발행사와 발행일 조합을 기준으로 중복을 줄인다.

추적 파라미터가 붙은 URL도 최대한 같은 URL로 취급한다. 예를 들어 `utm_source` 같은 값은 제거해서 비교한다.

### 7단계: 저장

새 항목과 기존 항목을 병합한 뒤 `data/items/YYYY-MM-DD.json` 일별 shard에 쓴다. 실행 결과는 `data/collection-state.json`에 쓴다.

## 7. GitHub Actions 흐름

GitHub Actions는 두 가지 워크플로를 가진다.

```text
.github/workflows/ci.yml
.github/workflows/collect.yml
```

### CI

`ci.yml`은 push와 pull request에서 실행된다.

검증 순서는 다음과 같다.

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run validate:data
pnpm run build
```

즉 코드 스타일, 타입, 테스트, 데이터 무결성, Next.js 빌드를 모두 확인한다.

### 수집 워크플로

`collect.yml`은 예약 실행과 수동 실행을 지원한다.

```text
매시 47분에 실행
또는 workflow_dispatch로 수동 실행
```

수집 워크플로는 다음 순서로 돈다.

```text
Checkout
↓
pnpm 설치
↓
Node 설치
↓
의존성 설치
↓
pnpm run collect
↓
pnpm run validate:data
↓
data/ 변경이 있으면 Update radar data 커밋
↓
git push
```

Naver API 키는 GitHub 저장소 Secrets에서 가져온다. `.env` 파일은 GitHub에 올라가지 않는다.

## 8. Vercel 배포 흐름

Vercel은 데이터를 직접 수집하지 않는다. Vercel의 역할은 화면을 빌드하고 배포하는 것이다.

```text
GitHub main 브랜치에 push
        ↓
Vercel이 push 감지
        ↓
pnpm install
        ↓
pnpm run build
        ↓
Next.js 앱 배포
```

GitHub Actions가 `data/` 변경 커밋을 만들면 그 커밋도 `main`에 push된다. Vercel은 이 push를 감지해서 최신 JSON 데이터가 반영된 화면을 다시 배포한다.

MVP 기준으로 Vercel에는 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`을 넣지 않는다. Naver API 호출은 GitHub Actions에서만 한다.

## 9. 로컬 개발 흐름

처음 세팅:

```bash
pnpm install
```

개발 서버 실행:

```bash
pnpm run dev
```

로컬 검증:

```bash
pnpm test
pnpm run lint
pnpm run typecheck
pnpm run validate:data
pnpm run build
```

Naver API까지 로컬에서 테스트하려면 `.env`에 값을 넣고 다음 명령을 실행한다.

```bash
pnpm run collect:local
```

`.env`는 `.gitignore`에 포함되어 있으므로 커밋하지 않는다.

## 10. 데이터 검증

데이터 검증은 `scripts/validate-data.ts`와 `lib/validation.ts`가 담당한다.

검증 명령:

```bash
pnpm run validate:data
```

검증하는 대표 항목:

- 모든 `id`가 중복되지 않는지
- `issueTags`가 실제 `issues.json`의 id를 가리키는지
- `personTags`가 실제 `people.json`의 id를 가리키는지
- URL 중복이 없는지
- summary가 너무 길지 않은지
- 위험한 단정 라벨이 들어가지 않았는지
- `collection-state.totalItems`가 실제 items 개수와 맞는지

## 11. 준비 상태 확인

`pnpm run check:readiness`는 로컬 코드만으로는 알 수 없는 외부 상태를 확인한다.

확인 대상:

- GitHub 저장소 시크릿 `NAVER_CLIENT_ID`
- GitHub 저장소 시크릿 `NAVER_CLIENT_SECRET`
- GitHub deployment 기록
- 최신 CI 워크플로 결과
- 최신 수집 워크플로 결과

일반 실행:

```bash
pnpm run check:readiness
```

하나라도 실패하면 exit code를 실패로 만들고 싶을 때:

```bash
pnpm run check:readiness -- --strict
```

## 12. 자주 보는 파일

수집 키워드를 바꾸고 싶으면:

```text
data/issues.json
data/people.json
lib/classify.ts
```

수집 출처를 바꾸고 싶으면:

```text
data/sources.json
scripts/collect-official.ts
```

데이터 구조를 바꾸고 싶으면:

```text
lib/schema.ts
lib/validation.ts
tests/schema.test.ts
tests/validation.test.ts
```

화면 구성을 바꾸고 싶으면:

```text
app/
components/
lib/stats.ts
lib/filter.ts
```

자동 수집 주기를 바꾸고 싶으면:

```text
.github/workflows/collect.yml
```

## 13. 안전 원칙

이 프로젝트는 사람 이름과 조직 이슈를 다루므로 보수적으로 운영한다.

- 기사 본문 전체를 저장하지 않는다.
- 기사 이미지를 복제하지 않는다.
- 자동으로 부정적 단정 라벨을 붙이지 않는다.
- 카드에는 원문 링크를 반드시 제공한다.
- 자동 태그는 키워드 기반이며 틀릴 수 있다고 본다.
- 데이터가 이상하면 수집량을 늘리기보다 필터와 검증을 먼저 고친다.
