# Korea Football Radar

Korea Football Radar는 한국 축구 거버넌스 관련 뉴스와 공식자료 메타데이터를 모아 보여주는 Next.js 대시보드입니다. 저장 대상은 원문 전체가 아니라 제목, 짧은 설명, 태그, 발행/수집 시각, 원문 링크 같은 메타데이터입니다.

## 기술 스택

- Next.js App Router
- TypeScript
- Tailwind CSS
- pnpm
- GitHub Actions scheduled collector
- Docker + Cloudflare Tunnel (Mac mini home server)
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

수집 스크립트는 메타데이터를 `data/items/YYYY-MM-DD.json` 일별 shard에 쓰고,
비슷한 뉴스의 관계를 `data/story-clusters.json`에 저장하며, 실행 상태를
`data/collection-state.json`에 기록합니다.

```bash
pnpm run collect
pnpm run collect:local
pnpm run collect:naver
pnpm run collect:official
pnpm run reclassify:news
pnpm run rebuild:story-clusters
```

`reclassify:news`는 저장된 뉴스의 제목과 요약을 현재 관련도 규칙으로 다시
분류하고, 기준에서 벗어난 항목을 제거합니다. 이슈 규칙이나 관련도 정책을
바꾼 뒤 기존 데이터까지 일관되게 갱신할 때 사용합니다.

뉴스 묶음은 36시간 안에 발행된 기사끼리 제목과 요약의 유사도, 공통 이슈·인물
태그를 비교해 수집 시점에 다시 계산합니다. `41배`처럼 여러 발행처에서 짧은 시간에
집중된 희소 사실값은 먼저 같은 사건으로 묶고, 제목 유사도가 매우 높으면 서로 다른
문단을 잘라 온 요약문 때문에 탈락하지 않도록 요약 조건을 면제합니다. 칼럼·사설과
일반적인 기간 표현은 이 예외에서 제외합니다. 화면에서는 묶음마다 대표 기사 한 건과
관련 기사 두 건을 먼저 보여주고 나머지는 펼쳐 볼 수 있습니다. 대표 기사는 주요
수집 항목을 우선한 뒤 묶음 중심성, 관련도, 제목·요약 완성도, 최신성을 함께 평가해
정합니다. 홈 검색 결과와 이슈·인물 목록에는 묶음을 적용하지만, `/sources`의 원문
링크 목록은 감사 가능한 수집 기록이므로 모든 원문을 개별 항목으로 유지합니다.

묶음 규칙만 바꾼 뒤 저장된 기사 전체를 다시 계산하려면
`pnpm run rebuild:story-clusters`를 사용합니다.

Naver News collector는 아래 환경변수를 읽습니다.

```bash
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```

GitHub Actions에서 Naver News API를 사용하려면 두 값을 저장소 시크릿에 추가해야 합니다. 값이 없으면 Naver API 수집은 건너뛰고 공식자료 수집과 데이터 검증만 실행합니다.

로컬 `.env` 파일에 Naver 키를 넣어 테스트할 때는 `pnpm run collect:local`을 사용합니다. 기본 수집 명령인 `pnpm run collect`는 GitHub Actions 환경변수 또는 현재 셸 환경변수만 읽습니다.

## 준비 상태 확인

`pnpm run check:readiness`는 로컬 빌드만으로 증명할 수 없는 외부 상태를 확인합니다.

- `NAVER_CLIENT_ID` 저장소 시크릿
- `NAVER_CLIENT_SECRET` 저장소 시크릿
- 홈서버 공개 health endpoint와 선택한 immutable release
- 최신 CI 워크플로 결과
- 최신 수집 워크플로 결과

모든 외부 설정이 끝날 때까지 명령이 실패해야 하는 상황에서는 strict 모드를 사용합니다.

```bash
pnpm run check:readiness -- --strict
```

현재 미완료 외부 확인 작업은 [docs/remaining-work.md](docs/remaining-work.md)에 정리합니다.

## 문서

- [MVP 기획서](docs/mvp-plan.md): 제품 범위, 제외 기능, 데이터 모델, 완료 기준
- [전체 작동 구조](docs/system-overview.md): 수집부터 화면 배포까지 이어지는 흐름
- [잔여 작업](docs/remaining-work.md): 실제로 남아 있는 외부 확인 작업

## 맥미니 홈서버 배포

운영 앱은 Docker 이미지로 빌드해 `home-server-infra`의 private Docker network와
Cloudflare Tunnel 뒤에서 실행합니다. `/api/feed`가 있으므로 정적 파일 호스팅으로
대체하지 않습니다. 컨테이너는 빌드 시점의 `data/` snapshot을 포함하며, 수집
workflow가 데이터를 push한 뒤에는 새 Git commit으로 이미지를 빌드·선택·재생성해야
공개 사이트에 반영됩니다.

`NEXT_PUBLIC_SITE_URL`은 구매한 별도 도메인의 canonical HTTPS URL로 설정합니다.
컨테이너의 상태 확인 endpoint는 `GET /api/health`이며 성공 응답은
`{"status":"ok"}`입니다. Naver API key는 GitHub Actions에서만 사용하므로
홈서버 런타임에 저장하지 않습니다.

공유 인프라에 서비스가 등록된 뒤의 실제 배포 절차와 도메인/DNS cutover는
`docs/home-server-deployment.md`를 따릅니다.

## 안전 원칙

- 기사 본문 전체를 저장하지 않습니다.
- 기사 이미지를 복제하지 않습니다.
- 자동으로 명예훼손 위험이 큰 단정 라벨을 붙이지 않습니다.
- 모든 항목은 원문 확인 가능한 `http(s)` 링크를 가져야 합니다.
- 자동 태그는 키워드 매칭 결과이며 틀릴 수 있습니다.
