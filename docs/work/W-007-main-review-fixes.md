# W-007 · 코드 검토에서 확인한 오류 5건 수정

- 상태: 완료
- 최근 갱신: 2026-10-02
- 관련 문서: [docs/README.md](../README.md), [docs/specs.md](../specs.md), [docs/architecture.md](../architecture.md)

## 현재 상황

다섯 수정과 회귀 테스트를 완료했다. 전체 테스트 396개, lint, 타입 검사, 데이터 검증, 프로덕션 빌드와 상세 화면의 실제 브라우저 검증을 통과했다. 변경은 로컬 미커밋 상태이며 기존 데이터의 확정 Shorts 2건 정리는 수정 코드가 반영된 다음 수집에서 적용된다.

- 완료 조건: 다섯 재현 조건이 수정 후 회귀 테스트를 통과하고 lint·타입 검사·전체 테스트·데이터 검증·빌드 결과를 확인한다.
- 사람이 판단할 사항: 없음.

## 진행과 판단

### 배경과 범위

- 사전 검토에서 유튜브 부분 실패 시 미수집 구간 누락, 파일 복구 뒤 지연된 쓰기 재반영, 상세 목록 유형 혼입, 확정 Shorts 2건 잔존, 다른 브랜치 CI와 오래된 수집의 정상 오판을 확인했다.
- 코드와 테스트를 수정한다. 수집 산출물은 직접 편집하지 않으며, 기존 Shorts는 수정한 일반 수집 경로에서 제외한다. 실제 수집·재분류·R2 발행·배포·커밋은 이번 구현 검증에 포함하지 않는다.

### 중요한 시도와 결정

- 2026-10-02 — 유튜브의 표시용 `lastCollectedAt`과 재시도 기준 `collectionCursor`를 분리하기로 했다. 기존 상태 파일을 읽을 수 있도록 선택 필드로 추가하고, 최초 부분 실패와 명시적 과거 구간 수집도 회귀 테스트로 확인한다. 근거: [scripts/collection-run.ts](../../scripts/collection-run.ts), [scripts/collect-youtube.ts](../../scripts/collect-youtube.ts).
- 2026-10-02 — 날짜별 쓰기와 삭제는 모두 종료된 뒤 오류를 전달한다. 실제 저장·복구 경로에 지연·실패를 주입한 세 테스트는 수정 전 모두 실패, 수정 후 통과했다([lib/item-shards.ts](../../lib/item-shards.ts), [tests/item-shards-rollback.test.ts](../../tests/item-shards-rollback.test.ts)).
- 2026-10-02 — 상세 목록은 유형 변경과 더보기의 요청 식별자를 공유해 이전 응답·오류·snapshot 복구가 새 화면을 덮어쓰지 않도록 했다([components/PaginatedItemList.tsx](../../components/PaginatedItemList.tsx), [tests/paginated-item-list.test.ts](../../tests/paginated-item-list.test.ts)).
- 2026-10-02 — 일반 수집의 기존 항목 필터에 Shorts 캐시를 전달했다. 현재 저장 데이터의 확정 Shorts 2건이 메모리 실행에서 제외되고 판정 불명 영상은 보존되는 것을 확인했다. 저장 파일은 변경하지 않았다([tests/youtube.test.ts](../../tests/youtube.test.ts)).
- 2026-10-02 — 준비 상태는 `main`의 완료 실행과 실행 시각을 함께 판정한다. GitHub CLI 공식 문서에서 조회 옵션을 확인했고, 시크릿 조회를 모의해 PR 성공이 main 실패를 가리지 않는지 검증했다. 최신성 기준은 [docs/system-overview.md](../system-overview.md)에서 관리한다([scripts/check-readiness.ts](../../scripts/check-readiness.ts), [tests/check-readiness.test.ts](../../tests/check-readiness.test.ts)).

### 검증

- 사전 검토: Node v20.19.0, pnpm 10.33.1에서 테스트 361개, lint, 타입 검사, 데이터 검증 7,862건 통과.
- `pnpm run lint`, `pnpm run typecheck` — 통과. 마지막 회귀 테스트 두 건 보강 후 해당 파일 lint와 전체 타입 검사도 통과.
- `pnpm test` — 통과, 396개 테스트 / 75개 스위트. Node v20.19.0, pnpm 10.33.1, macOS 로컬.
- `pnpm run validate:data` — 통과, 항목 7,862건 / 묶음 850개. 기존 상태 파일 호환성 확인.
- `pnpm run build` — 통과, Next.js 15.5.20 프로덕션 빌드 및 라우트 생성 확인.
- Chromium / 로컬 `pnpm run dev` — 통과. 데스크톱 1280px·라이트의 `/issues/election`에서 이전 더보기 응답을 지연하고 유형을 바꾼 뒤 혼입 없이 뉴스 30건을 유지했다. 모바일 390px·다크의 `/people/person_chung_mong_gyu`에서는 409 이후 snapshot 재조회 응답을 지연하고 같은 결과를 확인했다. 두 경우 모두 페이지 JavaScript 오류와 가로 넘침이 없었다. API 응답은 브라우저에서 모의했고 실제 수집·외부 데이터 발행은 하지 않았다.
- 로컬 서버 포트와 Chromium 실행은 기본 샌드박스에서 권한 오류가 났고, 승인된 재실행으로 위 검증을 완료했다. 검증용 서버는 종료했다.
- `git diff --check` — 통과. `data/` 변경 없음. 운영 환경 확인·배포는 미실행.

### 세션 메모

- 2026-10-02 · Codex — 검토 결과에 대한 수정 요청을 받아 수집·파일 저장·운영 점검을 병렬 구현하고, 상세 목록 수정과 전체 검증을 진행한다.
- 2026-10-02 · Codex — 다섯 수정 및 전체 검증 완료. 교차 리뷰에서 확인한 초기 null 커서 보존과 필터 요청 실패 후 복원 테스트도 보강했다. 이후 첫 행동은 미커밋 diff 검토이며, 커밋·배포는 사용자 요청 시 진행한다.

## 남은 일

- [x] 유튜브 실패 구간의 수집 기준 시각 보존과 호환성 테스트
- [x] 파일 쓰기·삭제 완료 후 복구 시작 보장과 오류 회귀 테스트
- [x] 상세 목록 유형 변경 뒤 이전 요청의 결과·오류 무시와 회귀 테스트
- [x] 기존 항목의 확정 Shorts 제외와 unknown 보존 테스트
- [x] 운영 브랜치·최근 수집 시각 점검과 회귀 테스트
- [x] 전체 검증 및 문서 반영

재개에 필요한 코드 상태: 브랜치 `main`, 기준 커밋 `7b128d95`. 다섯 수정의 코드·테스트·문서가 미커밋 상태다. 미완료 구현은 없고 커밋·푸시·배포는 하지 않았다.
