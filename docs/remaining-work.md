# 잔여 작업 및 블로커

작성일: 2026-07-07

이 문서는 Korea Football Radar MVP에서 코드로 처리할 수 있는 범위를 넘어선 외부 설정 작업을 분리해 추적하기 위한 문서입니다. 현재 로컬 빌드와 GitHub Actions CI는 통과하지만, Naver API 기반 수집과 Vercel 실제 배포 확인은 외부 계정 설정이 필요합니다.

## 현재 상태

- 로컬 검증 명령은 pnpm 기준으로 구성되어 있습니다.
- GitHub Actions CI는 `pnpm install --frozen-lockfile`, 린트, 타입 검사, 테스트, 데이터 검증, 빌드를 실행합니다.
- GitHub Actions 수집 워크플로는 수동 실행과 예약 실행을 지원합니다.
- 데이터 저장은 저장소의 `data/*.json` 파일만 사용합니다.
- 기사 본문 전체, 기사 이미지, 명예훼손 위험이 큰 자동 단정 라벨은 저장하지 않습니다.

## 블로커

### 1. GitHub 저장소 시크릿 미설정

현재 필요한 저장소 시크릿:

```text
NAVER_CLIENT_ID
NAVER_CLIENT_SECRET
```

영향:

- Naver News Search API 수집이 건너뛰어집니다.
- 공식자료 수집과 데이터 검증은 계속 실행됩니다.
- 뉴스 기반 신규 후보가 충분히 쌓이지 않습니다.

나중에 처리할 일:

1. Naver Developers에서 Search API 사용 가능한 애플리케이션을 준비합니다.
2. GitHub 저장소 설정에서 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 시크릿을 추가합니다.
3. 수집 워크플로를 수동 실행합니다.
4. 워크플로 로그에서 Naver 후보 수집이 실행되는지 확인합니다.

확인 명령:

```bash
gh secret list
pnpm run check:readiness
```

### 2. Vercel 배포 연결 미완료

현재 GitHub 배포 기록이 없어 Vercel Git 연동으로 실제 배포된 증거가 없습니다.

영향:

- `pnpm run build`는 성공하지만, 공개 배포 URL과 자동 재배포 동작은 아직 확인되지 않았습니다.
- `pnpm run check:readiness -- --strict`는 배포 기록이 생기기 전까지 실패해야 정상입니다.

나중에 처리할 일:

1. Vercel에서 `gonasooc/k-football-radar` 저장소를 가져옵니다.
2. 프레임워크 프리셋은 `Next.js`로 둡니다.
3. 빌드 명령은 `pnpm run build`로 설정합니다.
4. 출력 디렉터리는 Vercel 기본값을 사용합니다.
5. 운영 브랜치는 `main`으로 설정합니다.
6. 배포가 끝나면 공개 URL에서 `/`, `/feed`, `/issues`, `/people`, `/sources`를 확인합니다.
7. `data/` 변경 커밋 이후 Vercel이 자동 재배포하는지 확인합니다.

확인 명령:

```bash
gh api repos/gonasooc/k-football-radar/deployments --jq length
pnpm run check:readiness
pnpm run check:readiness -- --strict
```

## 나중에 진행할 검증 체크리스트

외부 설정을 끝낸 뒤 아래 순서로 확인합니다.

```bash
pnpm install
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run validate:data
pnpm run build
pnpm run check:readiness -- --strict
```

GitHub Actions 쪽 확인:

```bash
gh run list --limit 5
gh run watch <run-id> --exit-status
```

## 현재 MVP 범위 밖 작업

아래 항목은 잔여 블로커가 아니라 향후 확장 후보입니다.

- Telegram 알림
- Supabase 또는 별도 데이터베이스 도입
- 관리자 검수 큐
- AI 요약
- Google Sheets 기반 태그 보정
- BigKinds 등 추가 뉴스 소스
- YouTube 기자회견/인터뷰 메타데이터 수집
- 커스텀 도메인 연결
