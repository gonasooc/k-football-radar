# W-001 · docs-starter 문서 구조 적용

- 상태: 진행 중
- 최근 갱신: 2026-09-21
- 관련 문서: [docs/README.md](../README.md), [AGENTS.md](../../AGENTS.md), 템플릿 원본 `gonasoo.dev/repositories/docs-starter`

## 현재 상황

docs-starter의 한국어 문서 구조를 이 저장소에 적용했다. `AGENTS.md`, `CLAUDE.md`, 문서 홈과 기본 문서 3종, 선택 문서 `docs/design.md`, 작업·세션 템플릿을 추가하고 `.gitignore`와 루트 `README.md`를 합쳤다. 기존 문서(`docs/mvp-plan.md`, `docs/system-overview.md`, `docs/r2-data-deployment.md`, `docs/home-server-deployment.md`, `docs/remaining-work.md`, 루트 `DESIGN.md`·`PRODUCT.md`·`.impeccable.md`)는 내용을 바꾸지 않고 문서 홈과 기본 문서에서 연결했다. 이후 2026-09-21에 `docs/remaining-work.md`만 내용을 쪼개 옮기고 삭제했다.

초기 내용은 코드·설정·데이터에서 확인한 사실로 채웠고, 확인하거나 결정할 수 없는 항목은 `미정`·`미확인`으로 남겼다. 2026-09-21 점검에서 템플릿 적용 절차에서 빠졌던 4건과 저장소 정리 항목 1건을 추가로 찾아 아래 ‘남은 일’에 넣었다.

- 완료 조건: 문서 홈에서 기본 문서와 기존 문서로 모두 이동할 수 있고, 기본 문서의 사실이 코드와 일치하며, `미정`으로 남긴 항목이 사용자 확인으로 정리된다.
- 사람이 판단할 사항: 없음. 문서 구조 결정 3건과 저장소 정리 1건은 2026-09-21에 모두 정리했고, 보존 상한은 [docs/work/W-002-main-item-retention-review.md](W-002-main-item-retention-review.md)로 분리했다. 남은 것은 새 세션에서 에이전트 연결을 확인하는 일뿐이다.

## 진행과 판단

### 배경과 범위

사람과 에이전트가 같은 한국어 문서를 기준으로 작업을 이어가도록 docs-starter 구조를 적용해 달라는 요청이다. 기존 문서와 에이전트 지침을 보존하고, 코드에서 확인한 내용으로 초기 문서를 작성하며, 확인할 수 없는 내용은 미정으로 남기는 것이 조건이다. 코드 동작 변경은 범위에 없다.

### 중요한 시도와 결정

- 2026-09-21 — 기존 `docs/`에 이미 상세 문서 5개가 있어 기본 문서가 같은 내용을 다시 담으면 이중 관리가 된다. docs-starter의 ‘같은 규칙을 여러 문서에 중복 관리하지 않는다’는 규칙에 따라, 기본 문서는 코드에서 확인한 사실과 규칙을 담고 상세 설명은 기존 문서로 연결하는 방식을 선택했다. 기존 문서는 수정하지 않았다.
- 2026-09-21 — `AGENTS.md`에서 템플릿 저장소 관리용 절인 ‘이 템플릿을 다룰 때’는 빼고, 이 프로젝트용 절로 대체했다. 안전 원칙, 기존 문서의 담당 범위, 사람이 관리하는 정책 파일과 스크립트가 쓰는 산출물의 구분을 담았다([AGENTS.md](../../AGENTS.md)).
- 2026-09-21 — 루트 `DESIGN.md`와 코드의 차이를 확인했다. 다크 테마 팔레트는 [app/globals.css](../../app/globals.css)에만 있고 문서에 없으며, `DESIGN.md`의 라이브 영상 제외 문장은 현재 동작과 다르다. 코드를 문서에 맞추지 않고 차이를 [docs/design.md](../design.md)에 기록했다.
- 2026-09-21 — `docs/remaining-work.md`를 내용별로 쪼개 옮기고 삭제했다. 정기 점검과 유튜브 과거 구간 수동 수집은 실행·검증을 담당하는 [docs/specs.md](../specs.md)의 ‘운영 점검과 수동 절차’로, 코드 배포 후 확인은 배포 절차를 담당하는 [docs/home-server-deployment.md](../home-server-deployment.md)의 ‘배포 후 확인’으로 갔다. 2026-07-28 확인 결과는 점검 절 끝에 날짜와 함께 남겼다. 열려 있는 작업은 문서 홈의 작업 목록이 담당하므로 ‘현재 잔여 작업’ 절은 옮기지 않았다. 이름이 작업 목록과 겹쳐 남은 일을 찾을 때 혼동을 주던 문제가 이걸로 사라진다.
- 2026-09-21 — 기본 문서와 기존 상세 문서의 담당 경계를 별도 표로 만들지 않기로 했다. `remaining-work.md`가 해체되어 겹치는 문서가 하나 줄었고, 기본 문서마다 ‘상세는 X 참고’ 한 줄이 이미 있어 표를 두면 그 표 자체가 또 하나의 동기화 대상이 된다. 중복이 실제 문제가 되면 그때 다시 본다.
- 2026-09-21 — `.gitignore`에 템플릿의 `Thumbs.db`는 넣지 않기로 했다. macOS 전용 저장소라 효과가 없다. 루트의 빈 `sessions/decisions/`는 삭제했다. Git에 추적되지 않는 로컬 디렉터리였고 새 `docs/sessions/`와 이름이 겹쳤다.
- 2026-09-21 — 사용자 결정에 따라 디자인 문서를 코드에 맞춰 현행화했다. 코드 변경은 하지 않았다. [DESIGN.md](../../DESIGN.md)에 ‘Dark Theme’ 절과 누락 토큰(`summary`, `shadow`)을 추가하고, 라이브 영상·`lead` 변형·타이포그래피 단계를 실제 구현으로 고쳤다. [.impeccable.md](../../.impeccable.md)에도 다크 테마 한 줄을 넣고, 디자인 문서 3종의 역할을 [docs/design.md](../design.md)에 나눠 적었다.
- 2026-09-21 — 남은 일의 기준을 다시 점검했다. 기존 목록은 docs-starter README의 ‘기존 프로젝트에 적용하기’ 5단계와 이번에 코드에서 찾은 불일치에서 나왔고, 템플릿 README의 나머지 약속(에이전트 연결 확인, 별도 TODO 파일 금지, `.gitignore` 병합)은 빠져 있었다. 누락분을 남은 일에 추가했다.
- 2026-09-21 — `DESIGN.md`가 말하는 `lead` 카드 변형은 코드에 없다. `components/ItemCard.tsx`, `components/StoryFeedEntryCard.tsx`, `components/YouTubeCard.tsx`의 변형은 모두 `"row" | "compact"`이고, `app/`·`components/`·`lib/`에 2.25rem(`text-4xl`) 타이포그래피도 없다. 확인이 끝났으므로 남은 것은 `DESIGN.md` 문장을 고칠지의 결정뿐이다.
- 2026-09-21 — 선택 문서인 `docs/design.md`를 가져왔다. UI가 있고 루트에 디자인 기준 문서가 이미 있어, 원본을 복제하지 않고 관찰된 구현·근거·불일치를 정리하는 진입점으로 작성했다.

### 검증

- `pnpm test` — 통과, 357개 테스트 / 70개 스위트, 약 9초 (macOS 26.6.2, Node v20.19.0, pnpm 10.33.1)
- `pnpm run typecheck` — 통과, 같은 환경
- `pnpm run lint` — 통과, 같은 환경
- `pnpm run validate:data` — 통과, 항목 5,044건 / 이슈 8건 / 인물 28건 / 출처 5건 / 묶음 567개
- 문서의 상대경로 링크 — 작성 직후 90개 확인 후, 작업 문서를 포함한 16개 파일의 102개를 다시 확인, 전부 실제 파일로 해석됨
- docs-starter 템플릿과 `.gitignore` 대조 — `docs/.local/`은 반영, `Thumbs.db`는 미반영(`.DS_Store`는 이미 있었음)
- `pnpm run build` — 미실행. 이번 변경은 문서와 `.gitignore`뿐이라 실행하지 않았다.

### 세션 메모

- 2026-09-21 13:44 KST · Claude Code (Opus 5) — 문서 구조 적용과 초기 작성을 마쳤다. 다음 행동은 사용자와 함께 미정 항목을 정리하는 것이다. 커밋은 하지 않았다.
- 2026-09-21 13:52 KST · Claude Code (Opus 5) — 남은 일의 출처를 점검해 누락 4건과 정리 항목 1건을 추가하고, `lead` 변형 부재를 코드로 확인했다. 다음 행동은 문서 구조 결정 3건을 사용자와 정하는 것이다.
- 2026-09-21 14:1x KST · Claude Code (Opus 5) — 사용자 결정을 반영했다. 디자인 문서를 코드에 맞춰 현행화하고 다크 테마 기준을 추가했으며, 보존 상한 검토는 W-002로 분리했다. 남은 것은 문서 구조 결정 3건이다.
- 2026-09-21 15:2x KST · Claude Code (Opus 5) — 문서 구조 결정 3건과 저장소 정리 1건을 모두 처리했다. `docs/remaining-work.md`는 해체·삭제, 담당 경계 표와 `Thumbs.db`는 하지 않기로, 빈 `sessions/decisions/`는 삭제. 남은 것은 새 세션에서의 에이전트 연결 확인뿐이다.

## 남은 일

- [x] `AGENTS.md`, `CLAUDE.md` 추가 (기존 지침 보존)
- [x] `docs/README.md`, `docs/plan.md`, `docs/architecture.md`, `docs/specs.md` 작성
- [x] 선택 문서 `docs/design.md` 작성
- [x] `docs/work/_template.md`, `docs/sessions/_template.md` 복사
- [x] `.gitignore`에 `docs/.local/` 추가, 루트 `README.md`에 문서 홈 링크 추가
- [x] `DESIGN.md`의 `lead` 카드 변형이 코드에 있는지 확인 — 없음
- [x] [docs/plan.md](../plan.md)의 ‘아직 결정할 사항’ 확인 — 유지보수 전념과 목표 지표 보류는 확정, 보존 상한은 [docs/work/W-002-main-item-retention-review.md](W-002-main-item-retention-review.md)로 분리
- [x] [docs/design.md](../design.md)의 불일치 처리 — 다크 테마 기준 문서화, 라이브 영상·`lead` 변형·타이포그래피 현행화, 디자인 문서 3종 역할 구분 완료
- [ ] 새 세션에서 에이전트가 `CLAUDE.md`의 `@AGENTS.md`로 지침을 읽는지, 안내한 문서 경로를 찾는지 확인 (docs-starter README의 ‘에이전트 연결과 기록 범위’)
- [x] `docs/remaining-work.md`의 위치 결정 — 내용을 `docs/specs.md`와 `docs/home-server-deployment.md`로 쪼개 옮기고 파일 삭제
- [x] 기본 문서와 기존 상세 문서의 담당 경계 — 별도 표를 만들지 않기로 결정
- [x] `.gitignore`의 `Thumbs.db` — 넣지 않기로 결정
- [x] 루트의 빈 `sessions/decisions/` 디렉터리 — 삭제
- [x] 문서 변경 커밋 — 2026-09-21, `docs: adopt the docs-starter Korean documentation structure`. push는 아직

재개에 필요한 코드 상태: `main` 브랜치. 문서 구조 커밋은 2026-09-21에 수집 봇 커밋 위로 재베이스했고(`3ba9e903`), 이후 문서 정리 변경이 이어진다. 아직 push하지 않았다.
