# Korea Football Radar — Codex 목표 계획서

문서 버전: 2026-07-07  
목적: Codex의 `/goal` 기능에 그대로 투입할 수 있는 MVP 구현 계획서  
최종 배포 방향: **Next.js + Vercel + GitHub Actions + JSON 데이터**

---

## 0. Codex에 줄 목표 문장

아래 문장을 Codex의 `/goal`에 넣고, 이 문서를 프로젝트 루트에 `KOREA_FOOTBALL_RADAR_GOAL.md`로 둔다.

```text
/goal KOREA_FOOTBALL_RADAR_GOAL.md에 따라 Korea Football Radar MVP를 구현한다. Vercel 배포에 적합한 Next.js TypeScript 앱을 만들고, GitHub Actions로 Naver News API와 공식자료 메타데이터를 수집해 /data 아래 JSON 파일로 커밋한다. 데이터베이스, CMS, 로그인, 댓글, AI 요약, 메신저 알림 없이 대시보드, 피드, 이슈 페이지, 인물 페이지, 출처 아카이브, 데이터 검증, 예약 수집 워크플로, Vercel 빌드가 모두 동작하면 MVP를 완료로 본다.
```

Codex가 작업 중 참고해야 할 원칙:

- 한 번에 모든 기능을 완성하려 하지 말고, **작동하는 얇은 세로 조각**을 먼저 만든다.
- 각 단계는 `pnpm run lint`, `pnpm run typecheck`, `pnpm run validate:data`, `pnpm run build` 중 가능한 검증을 통과해야 한다.
- 자동 수집 결과는 뉴스·공식자료의 **메타데이터와 원문 링크**만 저장한다.
- 기사 본문 전체, 유료 기사, 로그인 필요 본문, 기사 이미지 원본은 저장하거나 재게시하지 않는다.
- 자동으로 “비리”, “범죄”, “의혹 확정” 같은 단정적 라벨을 붙이지 않는다.

---

## 1. 제품 정의

### 제품명

**Korea Football Radar**

### 한 줄 설명

축협, K-축구혁신위, 문체부, 회장 선거, 선거인단, 정관, 감사, 주요 인물 관련 뉴스·공식자료를 자동 수집해 한 화면에서 빠르게 파악하는 정보 레이더.

### 핵심 사용자

1. 프로젝트 소유자 본인
2. 한국축구 개혁 이슈를 빠르게 모니터링하고 싶은 축구 팬
3. K-축구혁신위, 대한축구협회, 문체부, 대한체육회 관련 흐름을 추적하려는 사람

### MVP의 최우선 목적

홍보성 랜딩 페이지나 커뮤니티 플랫폼이 아니라, **관련 정보를 빠르게 모아 보고 필터링하는 개인용/공개용 자동 수집 대시보드**를 만든다.

---

## 2. 확정 기술 스택

| 영역 | 선택 |
|---|---|
| 프론트엔드 | Next.js, TypeScript |
| 스타일 | Tailwind CSS |
| 배포 | Vercel |
| 데이터 저장 | Git 저장소 안의 JSON 파일 |
| 자동 수집 | GitHub Actions 예약 워크플로 |
| 뉴스 소스 | Naver News Search API |
| 공식자료 소스 | KFA, 문체부, 대한체육회 등 공식 페이지 HTML/RSS 감시 |
| DB | MVP 제외 |
| CMS | MVP 제외 |
| 메신저 알림 | MVP 제외 |
| 추후 알림 후보 | Telegram만 고려 |

---

## 3. 최종 아키텍처

```text
[Naver News Search API]
[KFA / 문체부 / 대한체육회 공식 페이지]
        ↓
[GitHub Actions: 30분마다 실행]
        ↓
[수집 스크립트]
        ↓
[중복 제거 + 키워드 기반 이슈/인물 태그]
        ↓
[data/items.json 업데이트]
        ↓
[GitHub 커밋]
        ↓
[Vercel Git 연동 자동 배포]
        ↓
[Next.js Korea Football Radar]
        ↓
오늘의 대시보드 / 전체 피드 / 이슈별 / 인물별 / 출처별
```

### 중요한 설계 판단

Vercel은 **화면을 배포하는 곳**으로 사용한다.  
데이터 수집과 JSON 업데이트는 Vercel Runtime에서 하지 않는다.  
데이터 수집은 GitHub Actions가 담당하고, 수집 결과를 저장소의 `/data` 폴더에 커밋한다. Vercel은 GitHub push를 감지해 자동으로 재배포한다.

---

## 4. MVP 포함 기능

### 4.1 `/` — 오늘의 대시보드

첫 화면에서 오늘 또는 최근 24시간의 흐름을 빠르게 파악한다.

필수 표시 항목:

- 최근 수집 시각
- 최근 24시간 신규 자료 수
- 공식자료 수
- 뉴스 수
- 많이 언급된 이슈 Top 5
- 많이 언급된 인물 Top 5
- 최신 수집 항목 10개
- 공식자료 최신 항목 우선 표시

### 4.2 `/feed` — 전체 수집 피드

모든 수집 결과를 날짜순으로 보여준다.

필수 기능:

- 전체 자료 목록
- 최신순 정렬
- 유형 필터: 전체, 뉴스, 공식자료
- 이슈 필터
- 인물 필터
- 키워드 검색, 클라이언트 사이드로 시작 가능
- 각 항목의 원문 링크 제공

카드 표시 필드:

- 유형: 뉴스 / 공식자료
- 제목
- 출처
- 발행일
- 수집일
- 감지 키워드
- 이슈 태그
- 인물 태그
- 원문 보기 링크

### 4.3 `/issues` 및 `/issues/[id]` — 이슈별 보기

초기 이슈:

- 회장 선거
- 선거인단
- 정관 개정
- K-축구혁신위
- 문체부 감사
- KFA 임원 동향
- 감독 선임
- 유소년·거버넌스

각 이슈 상세 페이지에는 해당 이슈와 매칭된 자료만 모아 보여준다.

### 4.4 `/people` 및 `/people/[id]` — 인물별 언급 기록

정치 이슈 사이트의 “인물별 언행·논란 모음”과 유사한 화면이지만, MVP에서는 중립적으로 **인물별 언급 기록**으로 표시한다.

필수 표시 항목:

- 인물명
- 직책 또는 관련 역할
- 별칭/검색 키워드
- 관련 이슈
- 최근 언급 수
- 해당 인물이 언급된 수집 항목 타임라인

주의:

- 자동으로 “논란”, “비리”, “의혹” 라벨을 붙이지 않는다.
- 자동 태그는 “언급됨”, “뉴스”, “공식자료”, “해명 키워드 포함” 정도로 제한한다.

### 4.5 `/sources` — 출처 아카이브

수집 대상과 수집된 원문 출처를 관리·공개한다.

필수 표시 항목:

- 공식자료 소스 목록
- 뉴스 API 기반 수집 설명
- 수집된 항목의 publisher별 통계
- 원문 링크 목록

---

## 5. MVP 제외 기능

아래 기능은 이번 goal에서 구현하지 않는다.

- 회원가입
- 로그인
- 댓글
- 제보 시스템
- 관리자 CMS
- Supabase 등 DB
- Vercel KV / Redis
- Slack / Discord / Telegram 알림
- AI 요약
- AI 논란 판정
- 기사 본문 전체 저장
- 유튜브 자막 수집
- 관계도 그래프
- 수동 검수 워크플로우
- 읽음 처리 / 개인 북마크

Telegram 알림은 추후 기능으로만 남긴다.

---

## 6. 데이터 모델

MVP 데이터는 `/data` 폴더의 JSON 파일로 관리한다.

```text
data/
  items.json
  people.json
  issues.json
  sources.json
  collection-state.json
```

### 6.1 `items.json`

모든 수집 결과의 핵심 데이터.

```json
[
  {
    "id": "item_20260707_001",
    "type": "news",
    "title": "대한축구협회 회장 선거제도 개편 논의 본격화",
    "summary": "네이버 뉴스 API description 또는 자체 작성/정규화된 짧은 설명",
    "url": "https://example.com/news/1",
    "originalUrl": "https://example.com/news/1",
    "publisher": "연합뉴스",
    "publishedAt": "2026-07-07T05:20:00.000Z",
    "collectedAt": "2026-07-07T05:35:00.000Z",
    "matchedKeywords": ["대한축구협회", "선거인단"],
    "issueTags": ["election", "electoral-college"],
    "personTags": ["person_hong"],
    "sourceType": "news",
    "isOfficial": false,
    "relevanceScore": 82
  }
]
```

필수 규칙:

- `id`는 안정적으로 생성한다. 예: URL hash 기반.
- `url`은 원문 확인 가능한 링크여야 한다.
- `summary`는 길게 쓰지 않는다.
- 기사 본문 전체를 저장하지 않는다.
- `issueTags`, `personTags`는 ID 배열로 저장한다.

### 6.2 `people.json`

```json
[
  {
    "id": "person_hong",
    "name": "홍길동",
    "aliases": ["홍 길동", "Hong Gil-dong"],
    "role": "대한축구협회 관련 인물",
    "keywords": ["홍길동", "홍 길동"],
    "priority": 1,
    "published": true
  }
]
```

### 6.3 `issues.json`

```json
[
  {
    "id": "election",
    "name": "회장 선거",
    "description": "대한축구협회장 선거와 후보, 선거 일정 관련 이슈",
    "keywords": ["회장 선거", "축구협회장", "대한축구협회장", "후보 등록"],
    "priority": 1
  },
  {
    "id": "electoral-college",
    "name": "선거인단",
    "description": "선거인단 구성, 대표성, 투표권 관련 이슈",
    "keywords": ["선거인단", "선거인", "대의원", "투표권"],
    "priority": 2
  }
]
```

### 6.4 `sources.json`

```json
[
  {
    "id": "naver_news",
    "name": "Naver News Search API",
    "type": "news-api",
    "url": "https://developers.naver.com/docs/serviceapi/search/news/news.md",
    "enabled": true
  },
  {
    "id": "kfa_media",
    "name": "KFA 미디어채널",
    "type": "official",
    "url": "https://media.kfa.or.kr/",
    "enabled": true
  },
  {
    "id": "mcst_press",
    "name": "문화체육관광부 보도자료",
    "type": "official",
    "url": "https://www.mcst.go.kr/",
    "enabled": true
  }
]
```

### 6.5 `collection-state.json`

마지막 수집 시각과 수집 통계를 기록한다.

```json
{
  "lastCollectedAt": "2026-07-07T05:35:00.000Z",
  "lastRunStatus": "success",
  "lastRunNewItems": 12,
  "totalItems": 348
}
```

---

## 7. 키워드 설계

### 7.1 기본 검색 키워드

```text
대한축구협회
KFA
K-축구혁신위원회
축구혁신위
축구협회 회장 선거
축구협회 선거인단
축구협회 정관
축구협회 감사
축구협회 해명
```

### 7.2 이슈 키워드

```text
회장 선거
선거인단
정관 개정
문체부 감사
거버넌스
유소년
감독 선임
선거운영위원회
사퇴
해명
가처분
재심의
```

### 7.3 인물 키워드

초기에는 10~20명 이하로 시작한다. `people.json`에 인물별 검색 키워드를 명시한다.

인물별 검색 쿼리 생성 예:

```text
"{인물명}" 대한축구협회
"{인물명}" 축구협회
"{인물명}" 선거
"{인물명}" 해명
"{인물명}" 감사
```

---

## 8. 수집 로직

### 8.1 Naver News 수집기

파일 예시:

```text
scripts/collect-naver-news.ts
```

역할:

1. `issues.json`, `people.json`에서 검색 키워드를 읽는다.
2. 기본 키워드와 인물별 키워드를 합쳐 검색 쿼리 목록을 만든다.
3. Naver News Search API를 호출한다.
4. 결과의 제목, 설명, 원문 링크, 네이버 링크, 발행일, 발행사를 정규화한다.
5. HTML entity와 태그를 제거한다.
6. URL 기준 중복 제거를 수행한다.
7. 제목/설명/키워드 기반으로 `issueTags`, `personTags`를 부여한다.
8. 기존 `items.json`과 병합한다.
9. 최근 90일 또는 최대 2,000개 정도로 보관량을 제한한다.

권장 API 호출 옵션:

```text
sort=date
display=20
start=1
```

### 8.2 공식자료 수집기

파일 예시:

```text
scripts/collect-official.ts
```

역할:

1. `sources.json`에서 `type: official`이고 `enabled: true`인 소스를 읽는다.
2. HTML 또는 RSS를 가져온다.
3. 링크 목록을 추출한다.
4. 제목, URL, 발행일 추정값을 정규화한다.
5. 기존 항목과 중복 제거한다.
6. `type: official`, `isOfficial: true`로 저장한다.

초기에는 선택자가 완벽하지 않아도 된다.
공식 페이지 수집은 뉴스 API보다 우선순위가 높지만, 파싱이 깨질 수 있으므로 실패해도 전체 워크플로가 죽지 않도록 처리한다.

### 8.3 중복 제거

파일 예시:

```text
lib/dedupe.ts
```

중복 제거 기준:

1. canonical URL
2. `originalUrl`
3. 제목 + 발행사 + 발행일 조합
4. 동일 제목의 유사 항목은 최신 수집 건만 유지

### 8.4 분류

파일 예시:

```text
lib/classify.ts
```

분류 기준:

- 이슈 태그: `issues.json.keywords`가 제목/설명에 포함되면 부여
- 인물 태그: `people.json.keywords`가 제목/설명에 포함되면 부여
- 공식자료 여부: 공식자료 수집기 또는 출처 도메인 기반으로 판단
- relevanceScore: 단순 규칙 기반 점수

예시 점수:

```text
공식자료: +30
제목에 대한축구협회/축구혁신위 포함: +20
이슈 키워드 매칭: +10 each
인물 키워드 매칭: +8 each
해명/사퇴/감사/선거인단 등 고관심 키워드 포함: +5 each
```

---

## 9. 추천 프로젝트 구조

```text
korea-football-radar/
  app/
    layout.tsx
    page.tsx
    feed/
      page.tsx
    issues/
      page.tsx
      [id]/
        page.tsx
    people/
      page.tsx
      [id]/
        page.tsx
    sources/
      page.tsx

  components/
    DashboardStats.tsx
    FilterBar.tsx
    ItemCard.tsx
    IssueBadge.tsx
    PersonBadge.tsx
    SourceBadge.tsx
    EmptyState.tsx

  data/
    items.json
    people.json
    issues.json
    sources.json
    collection-state.json

  lib/
    data.ts
    classify.ts
    dedupe.ts
    date.ts
    normalize.ts
    schema.ts
    stats.ts

  scripts/
    collect-naver-news.ts
    collect-official.ts
    update-data.ts
    validate-data.ts

  .github/
    workflows/
      collect.yml
      ci.yml

  package.json
  next.config.ts
  tsconfig.json
```

---

## 10. Next.js 구현 지침

### 10.1 렌더링 방식

- Vercel 배포 기준이므로 `output: 'export'`는 필수 아님.
- MVP에서는 API Routes, Server Actions, DB 연결 없이 JSON 파일을 읽어 정적 데이터 중심으로 렌더링한다.
- 동적 라우트 `/issues/[id]`, `/people/[id]`는 JSON 목록을 기반으로 생성한다.
- 검색/필터 UI는 클라이언트 컴포넌트로 구현해도 된다.

### 10.2 `next.config.ts`

최소 설정:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true
  }
};

export default nextConfig;
```

기사 썸네일을 무단으로 가져오지 않을 계획이므로 `next/image` 최적화는 MVP에서 중요하지 않다.

---

## 11. GitHub Actions 설계

### 11.1 시크릿

GitHub 저장소 시크릿에 다음 값을 넣는다.

```text
NAVER_CLIENT_ID
NAVER_CLIENT_SECRET
```

주의:

- `.env` 파일을 공개 저장소에 커밋하지 않는다.
- API 시크릿을 브라우저 코드에 노출하지 않는다.
- Vercel 환경변수에는 MVP 기준으로 Naver 시크릿을 넣을 필요가 없다. 수집은 GitHub Actions에서만 한다.

### 11.2 `collect.yml`

권장 스케줄: 30분마다, 정각을 피해서 실행.

```yaml
name: Collect Korea Football Radar Data

on:
  schedule:
    - cron: "7,37 * * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  collect:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Setup pnpm
        uses: pnpm/action-setup@v6
        with:
          run_install: false

      - name: Setup Node
        uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Collect data
        run: pnpm run collect
        env:
          NAVER_CLIENT_ID: ${{ secrets.NAVER_CLIENT_ID }}
          NAVER_CLIENT_SECRET: ${{ secrets.NAVER_CLIENT_SECRET }}

      - name: Validate data
        run: pnpm run validate:data

      - name: Commit updated data
        run: |
          git config user.name "korea-football-radar-bot"
          git config user.email "korea-football-radar-bot@users.noreply.github.com"
          git add data/
          git diff --cached --quiet || git commit -m "Update radar data"
          git push
```

Vercel은 GitHub 저장소의 push를 감지해 자동 배포한다.

### 11.3 `ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v7

      - name: Setup pnpm
        uses: pnpm/action-setup@v6
        with:
          run_install: false

      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run typecheck
      - run: pnpm test
      - run: pnpm run validate:data
      - run: pnpm run build
```

---

## 12. Vercel 배포 지침

### 12.1 배포 방식

1. GitHub 저장소 생성
2. Vercel에서 해당 저장소 가져오기
3. 프레임워크 프리셋: Next.js
4. 빌드 명령: `pnpm run build`
5. 출력 디렉터리: 기본값 사용
6. 운영 브랜치: `main`
7. 이후 GitHub Actions가 `data/` 변경을 커밋하면 Vercel이 자동 재배포

### 12.2 Vercel 환경변수

MVP 기준 Vercel에는 필수 시크릿이 없다.

수집은 GitHub Actions에서만 실행한다.  
Vercel은 이미 생성된 JSON을 읽어 화면만 렌더링한다.

### 12.3 주의 사항

- Vercel Runtime에서 데이터를 파일로 저장하려 하지 않는다.
- Vercel Serverless Function으로 주기 수집을 구현하지 않는다.
- Cron은 GitHub Actions가 담당한다.

---

## 13. 패키지 스크립트

`package.json`에는 최소한 아래 scripts를 둔다.

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "test": "node --import tsx --test tests/*.test.ts",
    "collect": "node --import tsx scripts/update-data.ts",
    "collect:naver": "node --import tsx scripts/collect-naver-news.ts",
    "collect:official": "node --import tsx scripts/collect-official.ts",
    "check:readiness": "node --import tsx scripts/check-readiness.ts",
    "validate:data": "node --import tsx scripts/validate-data.ts"
  }
}
```

권장 의존성:

```text
next
react
react-dom
typescript
tailwindcss
zod
tsx
cheerio
html-entities
```

---

## 14. UI 톤과 정보 표현 원칙

### 14.1 톤

- 분석적
- 중립적
- 빠른 파악 중심
- 과장된 정치 캠페인 톤 지양

### 14.2 라벨

사용 가능한 라벨:

```text
뉴스
공식자료
인물 언급
해명 키워드 포함
감사 키워드 포함
선거 키워드 포함
공식 출처
자동 수집
```

피해야 할 자동 라벨:

```text
비리
범죄
확정 의혹
부패
유착
문제 인물
블랙리스트
```

### 14.3 기사 표현

카드에는 다음만 표시한다.

- 제목
- 출처
- 발행일
- 짧은 description 또는 자체 정규화 요약
- 원문 링크
- 자동 매칭 태그

표시하지 않는 것:

- 기사 본문 전체
- 기사 이미지 무단 복제
- 유료 기사 전문
- 로그인 필요 본문

---

## 15. 개발 순서

### 단계 1 — Next.js 뼈대와 샘플 데이터

완료 조건:

- Next.js TypeScript 프로젝트 생성
- Tailwind CSS 설정
- `/data` 샘플 JSON 작성
- `/`, `/feed`, `/issues`, `/people`, `/sources` 라우트 생성
- `pnpm run build` 성공

### 단계 2 — 데이터 로딩과 UI 카드

완료 조건:

- `lib/data.ts`에서 JSON 로딩
- `ItemCard`, `IssueBadge`, `PersonBadge`, `DashboardStats` 구현
- 대시보드 통계 계산
- 피드 필터 구현
- 이슈/인물 상세 페이지 구현

### 단계 3 — 데이터 검증

완료 조건:

- `zod` schema 작성
- `scripts/validate-data.ts` 작성
- `pnpm run validate:data` 통과
- 잘못된 JSON 구조일 때 명확한 에러 출력

### 단계 4 — Naver News 수집기

완료 조건:

- Naver News Search API 호출
- 키워드별 검색
- 결과 정규화
- 중복 제거
- issue/person 태그 부여
- `items.json` 업데이트
- API 시크릿은 GitHub Actions 환경변수로만 사용

### 단계 5 — 공식자료 수집기

완료 조건:

- `sources.json` 기반 공식자료 가져오기
- 링크/제목 추출
- 실패해도 전체 수집은 계속 진행
- 공식자료 항목은 `isOfficial: true`로 저장

### 단계 6 — GitHub Actions 자동 수집

완료 조건:

- `collect.yml` 작성
- `workflow_dispatch`로 수동 실행 가능
- 예약 일정으로 자동 실행 가능
- `data/` 변경이 있을 때만 커밋
- 커밋 후 Vercel 자동 배포 확인

### 단계 7 — Vercel 배포

완료 조건:

- Vercel에 GitHub 저장소 가져오기
- `main` 브랜치 push 시 자동 배포
- 최신 JSON 데이터가 반영된 화면 확인
- 모바일 화면 기본 사용성 확인

---

## 16. 완료 기준

Codex는 아래 조건을 모두 만족하면 목표를 완료로 판단한다.

1. `pnpm run build`가 성공한다.
2. `pnpm run typecheck`가 성공한다.
3. `pnpm run validate:data`가 성공한다.
4. `/` 대시보드에서 최신 수집 항목과 통계가 보인다.
5. `/feed`에서 전체 수집 항목이 최신순으로 보인다.
6. `/feed`에서 유형, 이슈, 인물 필터가 동작한다.
7. `/issues`와 `/issues/[id]`가 동작한다.
8. `/people`와 `/people/[id]`가 동작한다.
9. `/sources`에서 수집 출처가 보인다.
10. `pnpm run collect`가 `data/items.json`을 갱신한다.
11. 중복 URL이 반복 저장되지 않는다.
12. Naver API 키가 저장소에 노출되지 않는다.
13. GitHub Actions `collect.yml`이 수동 실행 가능하다.
14. Vercel 배포에 적합한 Next.js 프로젝트 구조다.
15. 기사 본문 전체를 저장하거나 재게시하지 않는다.
16. 자동으로 명예훼손 위험이 큰 단정 라벨을 붙이지 않는다.

---

## 17. 향후 확장, MVP 이후

MVP 완료 후 고려할 기능:

1. Telegram 알림
2. Google Sheets 기반 태그 보정
3. Supabase 도입
4. 관리자 검수 큐
5. AI 요약, 단 검수 후 공개
6. BigKinds 또는 다른 뉴스 데이터 소스 추가
7. YouTube 기자회견/인터뷰 메타데이터 수집
8. 검색 고도화
9. 인물별 공식 발언/해명 분리
10. 커스텀 도메인 연결

---

## 18. 리스크와 방어 원칙

### 18.1 저작권

- 기사 본문 전체를 저장하지 않는다.
- 기사 이미지를 무단 복제하지 않는다.
- 제목, 출처, 날짜, 링크, 짧은 설명 중심으로 표시한다.

### 18.2 명예훼손

- 자동 수집 데이터로 인물에 대한 부정적 단정을 하지 않는다.
- 자동 라벨은 중립적이어야 한다.
- “인물별 논란”이 아니라 “인물별 언급 기록”으로 표시한다.

### 18.3 데이터 품질

- 자동 분류는 틀릴 수 있음을 UI에 표시한다.
- 공식자료를 우선 노출한다.
- 출처 링크를 모든 카드에 제공한다.

### 18.4 API/운영

- Naver API 호출량을 제한한다.
- 실패 시 재시도 폭주를 막는다.
- 수집 실패가 빌드 실패로 이어지지 않도록 일부 수집기는 점진적 실패 처리를 한다.

---

## 19. 참고 공식 문서

확인일: 2026-07-07

- OpenAI Codex 목표 모드: https://developers.openai.com/codex/use-cases/follow-goals
- OpenAI Codex 목표 사용 예시: https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex
- OpenAI Codex 프롬프트 모범 사례: https://developers.openai.com/codex/prompting
- Next.js 정적 내보내기 가이드: https://nextjs.org/docs/app/guides/static-exports
- Vercel GitHub 연동: https://vercel.com/docs/git/vercel-for-github
- Vercel 배포 문서: https://vercel.com/docs/deployments
- GitHub Actions 예약 워크플로 문서: https://docs.github.com/actions/using-workflows/events-that-trigger-workflows
- GitHub Actions 워크플로 문법: https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions
- GitHub Actions 과금 문서: https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions
- Naver News Search API: https://developers.naver.com/docs/serviceapi/search/news/news.md

---

## 20. Codex 작업 메모

Codex가 막히면 다음 우선순위를 따른다.

1. 먼저 샘플 데이터로 UI가 작동하게 만든다.
2. 그다음 데이터 검증을 붙인다.
3. 그다음 Naver collector를 붙인다.
4. 그다음 official collector를 붙인다.
5. 마지막으로 GitHub Actions와 Vercel 배포 준비를 정리한다.

완벽한 collector보다 **보이는 대시보드 + 안정적인 JSON 갱신 + 배포 가능한 구조**가 우선이다.
