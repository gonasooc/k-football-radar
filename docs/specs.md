# 기술 명세

어떤 기술과 구현·검증 규칙을 따르는지 다룹니다. 구성 요소의 책임과 의존 관계 등 구조 규칙은 [docs/architecture.md](architecture.md)에서 관리합니다.

## 기술 구성

버전은 [package.json](../package.json) 기준이다.

| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 프레임워크 | Next.js `^15.0.0` App Router, React `^19.0.0` | `output: "standalone"` ([next.config.ts](../next.config.ts)) |
| 언어 | TypeScript `^5.7.2` | `strict: true`, `moduleResolution: "Bundler"`, `@/*` 경로 별칭 ([tsconfig.json](../tsconfig.json)) |
| 스타일 | Tailwind CSS `^3.4.17`, `@tailwindcss/forms`, `@tailwindcss/container-queries`, PostCSS `8.5.16` | 색상은 CSS 변수 기반, `darkMode: ["selector", '[data-theme="dark"]']` ([tailwind.config.ts](../tailwind.config.ts)) |
| 폰트·아이콘 | pretendard `1.3.9`, lucide-react | 본문·제목·숫자 모두 Pretendard |
| 스키마 검증 | Zod `^3.24.0` | 데이터 모델과 외부 응답 검증 ([lib/schema.ts](../lib/schema.ts)) |
| 수집 | cheerio `^1.0.0`, html-entities | 공식 페이지 HTML 파싱 |
| 데이터 발행 | `@aws-sdk/client-s3` `^3.1087.0` | Cloudflare R2 S3 API |
| 분석 | `@next/third-parties` GoogleAnalytics | `NEXT_PUBLIC_GA_ID`가 있을 때만 로드 |
| 실행 환경 | Node.js `>=20.18.0`(engines), pnpm `10.33.1` | CI와 운영 이미지는 Node 22 |
| 테스트 | `node --test` + tsx `^4.19.2` | `tests/*.test.ts` 45개 파일 |
| 정적 검사 | ESLint `^9.17.0` flat config, typescript-eslint, `@next/eslint-plugin-next` | `--max-warnings=0` ([eslint.config.mjs](../eslint.config.mjs)) |
| 데이터 저장 | 저장소 JSON + Cloudflare R2 snapshot | 관계형 DB 없음 |
| 배포 | Docker multi-stage + Docker Compose, Cloudflare Tunnel | [Dockerfile](../Dockerfile), [deploy/macos/compose.yaml](../deploy/macos/compose.yaml) |

## 지켜야 할 구현 규칙

- 데이터 모델은 [lib/schema.ts](../lib/schema.ts)의 Zod 스키마가 기준이다. 필드를 바꾸면 `lib/validation.ts`, `tests/schema.test.ts`, `tests/validation.test.ts`를 함께 고친다.
- 항목 하나는 제목, 짧은 설명(600자 이하), 원문 URL, 발행처, 발행·수집 시각, 이슈·인물 태그, 관련도 점수를 가진다. `type`과 `sourceType`은 항상 같아야 하고, 유튜브 항목만 영상 메타데이터를 가진다.
- 의미 키워드(`matchedKeywords`)와 수집에 사용한 검색어(`discoveryQueries`)를 섞지 않는다. 검색어로 찾았다는 사실은 관련도 근거가 아니다.
- 관련도 판정은 제목 근거를 설명 근거보다 강하게 본다. 설명에만 근거가 있는 항목은 primary로 승격하지 않는다(`lib/classify.ts`).
- 외부 응답은 Zod로 파싱한 뒤 사용한다. 공식자료 출처 하나의 fetch가 실패해도 전체 수집을 중단하지 않는다.
- 기존 데이터를 바꾸는 스크립트는 기본이 dry-run이다. 적용하려면 `--apply --confirm`을 명시해야 한다(`scripts/reclassify-youtube.ts`).
- 새 파일을 만들 때 저장소의 컨벤션을 따른다. ESM(`"type": "module"`), 명시적 확장자 없는 `@/` 별칭 import, 서버 전용 코드는 `lib/feed-context.ts` 쪽에 둔다.
- 테스트는 `node:test`와 `node:assert/strict`를 사용하고 파일명은 `tests/<주제>.test.ts`로 맞춘다. 외부 네트워크에 의존하지 않도록 fetch를 대체한다.
- 비밀값은 코드·문서·테스트에 넣지 않는다. 로컬은 `.env`(Git 무시), CI는 GitHub Secrets, 운영은 `deploy/macos/production.env`를 사용한다.

## 실행과 검증

| 목적 | 명령 또는 확인 방법 | 필요한 조건 |
| --- | --- | --- |
| 준비 | `pnpm install` | Node 20.18 이상, pnpm 10.33.1 |
| 실행 | `pnpm run dev` | 없음. 저장소의 `data/`를 읽는다 |
| 테스트 | `pnpm test` | 없음. 외부 네트워크를 쓰지 않는다 |
| 정적 검사 | `pnpm run lint`, `pnpm run typecheck` | 없음 |
| 데이터 검증 | `pnpm run validate:data` | 없음 |
| 빌드 | `pnpm run build` | 없음. `NEXT_PUBLIC_SITE_URL`이 없으면 `http://localhost:3000`으로 대체한다 |
| 로컬 수집 | `pnpm run collect:local`, `pnpm run collect:youtube:local` | `.env`의 Naver·YouTube 키. 외부 API 호출과 쿼터 소모 |
| 외부 준비 상태 | `pnpm run check:readiness [-- --strict]` | 로그인한 GitHub CLI |
| 운영 확인 | `curl --fail https://k-football-radar.app/api/health` | 배포된 앱. 정상은 `data.source: "r2"`, `data.stale: false` |

CI는 `lint → typecheck → test → validate:data → build` 순서로 모두 통과해야 한다([.github/workflows/ci.yml](../.github/workflows/ci.yml)). 로컬에서도 코드 변경 후 같은 순서를 권장한다.

2026-09-21 확인 결과(macOS 26.6.2, Node v20.19.0, pnpm 10.33.1): `pnpm test` 통과(357개 테스트, 70개 스위트, 약 9초), `pnpm run typecheck` 통과, `pnpm run lint` 통과, `pnpm run validate:data` 통과(항목 5,044건, 이슈 8건, 인물 28건, 출처 5건, 유튜브 쿼리 10건, preferred 채널 19개, 묶음 567개). `pnpm run build`는 이번에 실행하지 않았다.

환경 변수는 이름과 용도만 적는다. 실제 값은 [.env.example](../.env.example)의 설명을 보고 각 환경에 따로 넣는다.

| 이름 | 용도 | 사용하는 곳 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | canonical·OG URL의 기준 주소 | 빌드 시점 |
| `NEXT_PUBLIC_GA_ID` | Google Analytics 4 측정 ID. 비우면 비활성 | 빌드 시점 |
| `RADAR_DATA_BASE_URL` | R2 snapshot의 기준 URL. 운영에서 필수 | 앱 런타임 |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | Naver News Search API 인증 | 수집 스크립트 |
| `YOUTUBE_API_KEY` | YouTube Data API 인증 | 수집 스크립트 |
| `NAVER_QUERY_DELAY_MS`, `NAVER_FETCH_TIMEOUT_MS`, `OFFICIAL_SOURCE_TIMEOUT_MS` | 수집 호출 간격과 타임아웃 | 수집 스크립트 |
| `YOUTUBE_BACKFILL_DAYS`, `YOUTUBE_MAX_PAGES_PER_QUERY`, `YOUTUBE_MAX_PAGES_PER_CHANNEL`, `YOUTUBE_SHORTS_REDIRECT_PROBE`, `YOUTUBE_PUBLISHED_AFTER`, `YOUTUBE_PUBLISHED_BEFORE` | 유튜브 수집 범위와 쿼터 제어 | 수집 스크립트 |
| `ITEM_RETENTION_DAYS`, `MAX_RETAINED_ITEMS`, `MAX_RETAINED_SECONDARY_ITEMS`, `MAX_RETAINED_YOUTUBE_ITEMS` | 보존 기간과 종류별 건수 상한 | 수집 스크립트 |
| `CLOUDFLARE_ACCOUNT_ID`, `R2_BUCKET_NAME` | R2 발행 대상. GitHub Variables | 발행 스크립트 |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | R2 쓰기 인증. GitHub Secrets | 발행 스크립트 |
| `K_FOOTBALL_RADAR_*` | 홈서버 Compose가 읽는 이미지·사이트·데이터·네트워크 설정 | 운영 배포 |

수집 튜닝과 보존 관련 값은 모두 선택이며, 비어 있거나 허용 범위를 벗어나면 코드 안의 기본값을 사용한다(`lib/item-retention.ts`).

## 알려진 기술 제약

- `pnpm run collect`는 셸 환경변수만 읽는다. 로컬 `.env`로 시험하려면 `--env-file=.env`를 넘기는 `:local` 명령을 쓴다. `next dev`와 `next build`는 `.env`를 자동으로 읽는다.
- Naver 키가 없으면 Naver 수집을 건너뛰고 공식자료 수집과 검증만 실행한다. 로컬과 CI에서 시크릿 없이도 전체가 깨지지 않게 하려는 선택이다.
- YouTube 기본 수집은 검색어별 2페이지, 선별 채널별 5페이지로 제한한다. 과거 구간을 더 채우려면 `published_after`, `published_before`를 지정해 workflow dispatch로 나눠 실행한다.
- 원격 이미지는 `i.ytimg.com/vi/**`만 허용한다. 다른 호스트의 썸네일을 쓰려면 `next.config.ts`를 먼저 고쳐야 한다.
- `postcss`는 `8.5.16`으로 고정(override)되어 있다. 올릴 때는 Tailwind 빌드와 함께 확인한다.
- 운영 컨테이너는 read-only 파일시스템으로 실행하고 `/tmp`와 `.next/cache`만 tmpfs로 쓴다. 런타임에 파일을 쓰는 코드를 추가하면 배포에서 실패한다.
- 로컬 `node`는 v20.19.0이고 CI와 운영 이미지는 Node 22다. Node 22에서만 나타나는 차이는 CI에서 확인한다.
