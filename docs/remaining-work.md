# 잔여 작업 및 블로커

작성일: 2026-07-08

이 문서는 Korea Football Radar MVP에서 코드로 처리 가능한 작업과, 저장소 밖에서 별도로 처리해야 하는 외부 설정 작업을 분리해 추적한다.

## 현재 확인 상태

- 로컬 검증 명령은 pnpm 기준으로 구성되어 있다.
- 2026-07-08 기준 `pnpm test`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run validate:data`, `pnpm run build`가 통과한다.
- 2026-07-08 기준 로컬 `.env` 기반 `pnpm run collect:local` 수집이 성공했고, Naver 후보가 `data/items.json`에 반영됐다.
- 2026-07-08 기준 GitHub 저장소 시크릿 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`이 등록되어 있다.
- GitHub Actions 수집 워크플로 최신 실행은 성공 상태지만, 확인된 최신 실행은 시크릿 추가 전 실행이므로 시크릿 반영 후 수동 재실행이 필요하다.
- 데이터 저장은 저장소의 `data/*.json` 파일만 사용한다.
- 기사 본문 전체, 기사 이미지, 명예훼손 위험이 큰 자동 단정 라벨은 저장하지 않는다.

## 내가 별도로 진행해야 하는 작업

### 1. 수집 워크플로 수동 실행 및 로그 확인

GitHub 저장소 시크릿 추가는 완료됐다. 이제 수집 워크플로를 수동 실행해 GitHub Actions 환경에서도 Naver 후보를 실제로 조회하는지 확인해야 한다.

처리 순서:

1. GitHub Actions에서 `Collect Korea Football Radar Data` 워크플로를 수동 실행한다.
2. 워크플로 로그에서 `naver candidates` 값이 시크릿 없이 항상 0으로 고정되지 않는지 확인한다.
3. 공식자료 수집 실패가 있어도 전체 워크플로가 계속 진행되는지 확인한다.
4. `data/` 변경이 있으면 워크플로가 `Update radar data` 커밋을 만드는지 확인한다.

확인 명령:

```bash
gh workflow run "Collect Korea Football Radar Data"
gh run list --limit 5
gh run watch <run-id> --exit-status
```

### 2. Vercel 프로젝트 연결

현재 GitHub deployment 기록이 없어서 Vercel Git 연동 배포 증거가 없다.

처리 순서:

1. Vercel에서 `gonasooc/k-football-radar` 저장소를 가져온다.
2. Framework Preset은 `Next.js`로 둔다.
3. Build Command는 `pnpm run build`로 둔다.
4. Output Directory는 Vercel 기본값을 사용한다.
5. Production Branch는 `main`으로 둔다.
6. MVP 기준 Naver API 키는 Vercel 환경변수에 넣지 않는다.

확인 명령:

```bash
gh api repos/gonasooc/k-football-radar/deployments --jq length
pnpm run check:readiness
```

### 3. 공개 URL에서 주요 화면 확인

Vercel 첫 배포가 끝나면 실제 공개 URL에서 화면과 라우트를 확인해야 한다.

확인 순서:

1. `/`에서 최근 수집 시각, 최근 24시간 통계, 최신 수집 항목이 보이는지 확인한다.
2. `/feed`에서 유형, 이슈, 인물, 키워드 필터가 동작하는지 확인한다.
3. `/issues`와 `/issues/[id]`가 동작하는지 확인한다.
4. `/people`와 `/people/[id]`가 동작하는지 확인한다.
5. `/sources`에서 수집 대상, publisher 통계, 원문 링크 목록이 보이는지 확인한다.
6. 모바일 화면에서 주요 텍스트와 필터 UI가 겹치지 않는지 확인한다.

### 4. 데이터 변경 후 Vercel 자동 재배포 확인

GitHub Actions가 `data/` 변경을 커밋하면 Vercel이 push를 감지해 자동 재배포해야 한다.

확인 순서:

1. 수집 워크플로가 `data/` 변경 커밋을 만든 뒤 Vercel deployment가 새로 생성되는지 확인한다.
2. 공개 URL에서 최신 `data/collection-state.json` 기준 수집 시각이 반영되는지 확인한다.
3. 문제가 없으면 strict readiness를 실행한다.

최종 확인 명령:

```bash
pnpm run check:readiness -- --strict
```

## 코드 기준 완료 상태

- Next.js App Router 기반 라우트가 구현되어 있다.
- `/`, `/feed`, `/issues`, `/issues/[id]`, `/people`, `/people/[id]`, `/sources`가 빌드 시 생성된다.
- JSON 데이터 로딩, zod 스키마 검증, 데이터 무결성 검증이 구현되어 있다.
- URL canonical dedupe와 `originalUrl` 중복 검증이 구현되어 있다.
- Naver News collector는 시크릿이 없으면 안전하게 건너뛰고, 축구 맥락 없는 넓은 키워드 결과는 저장하지 않는다.
- 로컬 `.env` 수집 테스트용 `pnpm run collect:local` 스크립트가 있다.
- 공식자료 collector는 개별 소스 fetch 실패 시 전체 수집을 중단하지 않는다.
- GitHub Actions CI와 수집 워크플로 파일이 있다.

## 현재 MVP 범위 밖 작업

아래 항목은 잔여 블로커가 아니라 향후 확장 후보다.

- Telegram 알림
- Supabase 또는 별도 데이터베이스 도입
- 관리자 검수 큐
- AI 요약
- Google Sheets 기반 태그 보정
- BigKinds 등 추가 뉴스 소스
- YouTube 기자회견/인터뷰 메타데이터 수집
- 커스텀 도메인 연결
