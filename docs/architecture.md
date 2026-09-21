# 아키텍처

시스템을 어떻게 나누고 연결하는지 다룹니다. 기술 스택·버전과 구현·검증 규칙은 [docs/specs.md](specs.md)에서 관리합니다. 단계별 상세 설명과 예시는 [docs/system-overview.md](system-overview.md)에 있습니다.

## 구성 요소와 책임

| 구성 요소 | 책임 | 근거 |
| --- | --- | --- |
| 수집 워크플로 | 예약·수동 실행으로 수집 스크립트를 돌리고, 데이터 검증 뒤 `data/`를 커밋하고 R2에 발행한다 | `.github/workflows/collect.yml`, `.github/workflows/collect-youtube.yml` |
| 수집 스크립트 | 외부 API·웹페이지에서 메타데이터를 모아 분류·중복 제거·묶음 계산 후 저장한다 | `scripts/update-data.ts`, `scripts/collect-youtube.ts` |
| 저장소 데이터 | 수집 입력과 Git 이력을 담당한다. 정책 파일과 수집 산출물이 함께 있다 | `data/` |
| 데이터 발행 | 전체 데이터를 하나로 직렬화해 SHA-256 기반 immutable snapshot으로 올리고 `current.json`을 교체한다 | `scripts/publish-r2-data.ts` |
| Cloudflare R2 | 운영 앱이 읽는 데이터 제공 경로. `snapshots/<SHA-256>.json`과 `current.json`을 보관한다 | [docs/r2-data-deployment.md](r2-data-deployment.md) |
| 웹 애플리케이션 | R2 snapshot을 읽어 화면과 공개 API를 만든다. 외부 수집 API를 런타임에 호출하지 않는다 | `app/`, `components/`, `lib/` |
| 홈서버 배포 | 불변 Docker 이미지를 만들고 선택한 릴리스만 공유 ingress network와 Cloudflare Tunnel 뒤에서 실행한다 | `Dockerfile`, `deploy/macos/` |
| 외부 연동 | Naver News Search API, YouTube Data API, KFA·문체부·대한체육회 공식 페이지 | `data/sources.json` |

관계형 데이터베이스는 없다. 저장소의 JSON이 수집의 입력과 이력을, R2의 JSON snapshot이 운영 서비스의 데이터 제공을 담당한다.

## 주요 폴더와 흐름

```text
app/          화면 라우트와 API route handler
components/   화면을 구성하는 재사용 UI 컴포넌트
lib/          데이터 읽기·검증·분류·중복 제거·묶음·필터·통계 등 순수 로직
scripts/      수집, 검증, 발행, 재분류, 준비 상태 확인용 실행 스크립트
data/         정책 파일과 수집 산출물 JSON
tests/        node:test 기반 단위·회귀 테스트
deploy/       맥미니 Compose 구성과 릴리스 스크립트
public/       브랜드 이미지와 검색엔진 소유 확인 파일
reports/      수동 검토용 채널·재분류 보고서 산출물
docs/         프로젝트 문서
.github/      GitHub Actions 워크플로
```

수집에서 화면까지의 흐름은 다음과 같다.

```text
Naver News API / 공식 사이트 HTML / YouTube Data API
        ↓  scripts/collect-*.ts
lib/classify.ts → lib/dedupe.ts → lib/story-clusters.ts
        ↓  scripts/data-io.ts
data/items/YYYY-MM-DD.json, data/story-clusters.json, data/collection-state.json
        ↓  pnpm run validate:data → git commit → scripts/publish-r2-data.ts
R2 snapshots/<SHA-256>.json + current.json
        ↓  lib/remote-data.ts → lib/data.ts → lib/feed-context.ts
app/ 화면과 /api/feed, /api/source-links, /api/health
```

`data/`의 파일은 두 종류다. `items/`, `story-clusters.json`, `collection-state.json`, `youtube-format-cache.json`은 스크립트가 쓰는 산출물이고, `issues.json`, `people.json`, `sources.json`, `youtube-queries.json`, `youtube-channels.json`은 사람이 관리하는 정책 파일이다.

화면 라우트는 `홈 / 뉴스 / 유튜브 / 트래킹 / 출처`이며, 예전 주소는 화면 없이 이동만 한다.

```text
/           app/page.tsx
/news       app/news/page.tsx
/youtube    app/youtube/page.tsx
/tracking   app/tracking/page.tsx (?tab=people로 인물 탭)
/sources    app/sources/page.tsx
/issues/[id], /people/[id]

/feed   → /news                  app/feed/page.tsx
/issues → /tracking              app/issues/page.tsx
/people → /tracking?tab=people   app/people/page.tsx
```

공개 경로 중 화면이 아닌 것은 `/api/health`, `/api/feed`, `/api/source-links`, `/rss.xml`, `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`다.

## 지켜야 할 구조 규칙

- 운영 앱은 데이터를 수집하지 않는다. 수집과 외부 API 호출은 GitHub Actions에서만 하고, 앱은 R2 snapshot을 읽기만 한다.
- 운영 이미지에 `data/`를 복사하지 않는다. `RADAR_DATA_BASE_URL`이 있으면 R2를, 없고 개발·테스트 환경이면 저장소의 `data/`를 읽는다. 운영에서 값이 없으면 내장 데이터로 조용히 돌아가지 않고 오류를 낸다(`lib/data.ts`).
- 데이터 검증을 통과하지 못하면 R2 발행 단계에 도달하지 않는다. snapshot 업로드와 확인이 끝난 뒤에만 `current.json`을 교체한다.
- 런타임에 받은 snapshot은 byte 길이, SHA-256, object key, 수집 시각, Zod 스키마, 데이터 간 참조 무결성을 모두 확인한 값만 캐시한다(`lib/remote-data.ts`, `lib/data-snapshot.ts`).
- snapshot 하나에만 의존하는 파생값(표시용 항목 목록, 페이지네이션 토큰, 유사도 모델, 대표 기사 선정)은 `lib/feed-context.ts`에서 snapshot 객체를 키로 한 번만 계산한다. 요청마다 다시 만들면 전체 코퍼스를 매번 세우게 된다.
- `lib/feed-page.ts`는 클라이언트 컴포넌트도 import하므로 `node:` 모듈을 쓰는 코드를 넣지 않는다. 서버에서만 필요한 값은 `lib/feed-context.ts`에 둔다.
- 수집 산출물 저장은 `scripts/data-io.ts`가 담당하고, 항목·묶음·상태 중 하나라도 저장에 실패하면 이전 상태로 되돌린다.
- `reports/`의 산출물은 자동으로 반영되지 않는다. 채널 정책 변경은 사람이 `data/youtube-channels.json`을 고쳐야 일어난다.
- 두 수집 워크플로는 같은 `collect-radar-data` concurrency group을 쓰고 실행 전 `main`과 동기화한다. 둘 다 `data/collection-state.json`의 같은 줄을 고치기 때문이다.
- 앱 이미지는 코드가 바뀔 때만 다시 빌드·선택·배포한다. 수집 데이터 변경은 R2로 반영한다.

## 알려진 구조 제약

- 데이터 전체가 하나의 snapshot JSON이다. 보존 상한을 크게 올리면 직렬화·전송·검증 비용이 함께 커진다.
- 보존 정책에서 밀려난 항목은 작업 트리와 snapshot에서 사라진다. Git 이력에는 남으므로 `git show <sha>:data/items/YYYY-MM-DD.json`으로만 확인할 수 있다.
- `/api/feed`가 필요하므로 정적 파일 호스팅으로 대체할 수 없다. 운영은 Next.js standalone 서버를 실행한다.
- 앱 컨테이너는 호스트 포트를 열지 않고, `home-server-infra`가 만든 외부 ingress network와 이미 실행 중인 공유 Cloudflare Tunnel에 의존한다(`deploy/macos/compose.yaml`).
- R2가 일시적으로 실패하면 마지막 정상 snapshot을 계속 제공하고 health에 `stale: true`를 표시한다. 프로세스 시작 후 첫 요청부터 실패하면 `/api/health`가 503을 반환한다.
- Naver·YouTube API에는 호출 쿼터가 있어 검색어별 페이지 수를 제한한다. 과거 구간을 더 채우려면 기간을 나눠 수동 실행해야 한다.
