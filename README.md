# Korea Football Radar

Korea Football Radar는 한국 축구 거버넌스 관련 뉴스와 공식자료 메타데이터를 모아 보여주는 Next.js 대시보드입니다. 저장 대상은 원문 전체가 아니라 제목, 짧은 설명, 태그, 발행/수집 시각, 원문 링크 같은 메타데이터입니다.

## 기술 스택

- Next.js App Router
- TypeScript
- Tailwind CSS
- pnpm
- GitHub Actions scheduled collector
- JSON 데이터 파일, 데이터베이스 없음

## 로컬 개발

```bash
pnpm install
pnpm run dev
```

자주 쓰는 검증 명령:

```bash
pnpm test
pnpm run lint
pnpm run typecheck
pnpm run validate:data
pnpm run build
pnpm run check:readiness
```

## 데이터 수집

수집 스크립트는 메타데이터를 `data/items.json`에 쓰고, 실행 상태를 `data/collection-state.json`에 기록합니다.

```bash
pnpm run collect
pnpm run collect:naver
pnpm run collect:official
```

Naver News collector는 아래 환경변수를 읽습니다.

```bash
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```

GitHub Actions에서 Naver News API를 사용하려면 두 값을 저장소 시크릿에 추가해야 합니다. 값이 없으면 Naver API 수집은 건너뛰고 공식자료 수집과 데이터 검증만 실행합니다.

## 준비 상태 확인

`pnpm run check:readiness`는 로컬 빌드만으로 증명할 수 없는 외부 상태를 확인합니다.

- `NAVER_CLIENT_ID` 저장소 시크릿
- `NAVER_CLIENT_SECRET` 저장소 시크릿
- Vercel Git 연동으로 생성된 GitHub 배포 기록
- 최신 CI 워크플로 결과
- 최신 수집 워크플로 결과

모든 외부 설정이 끝날 때까지 명령이 실패해야 하는 상황에서는 strict 모드를 사용합니다.

```bash
pnpm run check:readiness -- --strict
```

현재 미완료 외부 작업과 블로커는 [docs/remaining-work.md](docs/remaining-work.md)에 정리합니다.

## 배포

이 앱은 기본 Next.js preset으로 Vercel에 배포할 수 있습니다.

1. Vercel에서 `gonasooc/k-football-radar` 저장소를 가져옵니다.
2. 프레임워크 프리셋은 `Next.js`를 사용합니다.
3. 빌드 명령은 `pnpm run build`를 사용합니다.
4. 출력 디렉터리는 Vercel 기본값을 사용합니다.
5. 운영 브랜치는 `main`으로 둡니다.
6. MVP 기준 Naver API key는 Vercel 환경변수에 넣지 않습니다. 데이터 수집은 GitHub Actions에서만 실행합니다.

GitHub Actions가 `data/` 변경을 커밋하면 Vercel Git 연동이 push를 감지해 정적 페이지를 다시 배포합니다.

## 안전 원칙

- 기사 본문 전체를 저장하지 않습니다.
- 기사 이미지를 복제하지 않습니다.
- 자동으로 명예훼손 위험이 큰 단정 라벨을 붙이지 않습니다.
- 모든 항목은 원문 확인 가능한 `http(s)` 링크를 가져야 합니다.
- 자동 태그는 키워드 매칭 결과이며 틀릴 수 있습니다.
