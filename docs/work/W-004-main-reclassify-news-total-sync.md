# W-004 · 뉴스 재분류의 수집기별 건수 동기화

- 상태: 완료
- 최근 갱신: 2026-09-29
- 관련 문서: [docs/README.md](../README.md), [docs/work/W-003-main-collector-total-sync.md](W-003-main-collector-total-sync.md), [scripts/reclassify-news.ts](../../scripts/reclassify-news.ts), [scripts/collection-run.ts](../../scripts/collection-run.ts)

## 현재 상황

W-003에서 후속 후보로 남긴 문제다. `pnpm run reclassify:news`는 재분류로 뉴스를 제거하면 최상위 `totalItems`만 고치고 `collectors.naver.totalItems`는 그대로 둬서, 실행 직후 `validate:data`가 실패했다. W-003의 건수 재계산을 공용 함수로 옮겨 재분류에도 적용했고, 데이터 복사본에서 수정 전후를 확인했다. `50a33372`로 `main`에 반영했고 CI가 통과해 완료했다.

- 완료 조건: 수정이 `main`에 반영돼 CI를 통과하고, 뉴스를 제거하는 `reclassify:news` 실행 뒤에도 `validate:data`가 통과한다(데이터 복사본에서 확인). — 충족
- 사람이 판단할 사항: `reclassify:news`에 dry-run을 둘지, 아니면 문서를 지금 동작에 맞출지(아래 관찰 참고). 이 작업의 완료 조건과는 별개다.

## 진행과 판단

### 배경과 범위

W-003을 닫은 뒤 "잔여 작업이 있으면 새 작업으로 진행"하라는 요청을 받았다. 범위는 `reclassify:news`가 쓰는 `data/collection-state.json`의 수집기별 건수다. [AGENTS.md](../../AGENTS.md)에 따라 저장소 데이터에는 재분류를 실행하지 않고, 세션 임시 폴더의 데이터 복사본에서만 실행했다.

### 원인

- 사실: [scripts/reclassify-news.ts](../../scripts/reclassify-news.ts)는 2026-07-13(`ebaba168`)에 만들어졌고, 수집기별 상태(`collectors`)는 그 뒤인 2026-07-17(`fc7851f3`) 유튜브 수집과 함께 생겼다. 이 스크립트는 그 뒤로 수집기별 건수를 맞추도록 바뀌지 않았다.
- 사실: 데이터 복사본(`262ca659`)에 현재 규칙이 제거하는 뉴스 1건을 넣고 실행하자 `Reclassified stored news: 7888 before, 7887 after, 1 removed` 뒤 `validate:data`가 `collection-state naver totalItems=7340 does not match items=7339`로 실패했다.

### 결정

- 2026-09-28 — W-003의 재계산 루프를 [scripts/collection-run.ts](../../scripts/collection-run.ts)의 `refreshCollectorTotals`로 옮겨 수집 실행과 재분류가 함께 쓴다. `reclassify-news.ts`는 저장 전 계산을 `prepareNewsReclassification`으로 분리해 파일을 쓰지 않고 테스트할 수 있게 했다. 명령의 동작(바로 적용)과 출력은 그대로다.
- [scripts/restore-evicted-news.ts](../../scripts/restore-evicted-news.ts)와 [scripts/reclassify-youtube.ts](../../scripts/reclassify-youtube.ts)는 이미 건수를 맞추므로 건드리지 않았다.
- [docs/specs.md](../specs.md)의 건수 규칙에 공용 함수 이름을 적어, 항목을 저장하는 새 스크립트가 같은 함수를 쓰도록 했다.

### 관찰 (범위 밖)

- `reclassify:news`에는 dry-run이 없다. [README.md](../../README.md)는 바로 적용하는 명령으로 설명한다. 반면 [docs/specs.md](../specs.md)는 "기존 데이터를 바꾸는 스크립트는 기본이 dry-run"이라고 하고, [AGENTS.md](../../AGENTS.md)도 `reclassify:*`를 dry-run과 apply가 나뉜 명령처럼 적는다.
- 뉴스 수집([scripts/update-data.ts](../../scripts/update-data.ts))은 실행마다 저장된 뉴스 전체에 같은 재분류 필터를 적용한다. 그래서 규칙 변경은 `main`에 올라가면 다음 수집에서 dry-run 없이 반영된다. `reclassify:news`의 dry-run은 로컬에서 미리 보는 용도로만 의미가 있다.
- 단독 실행 `collect:naver`, `collect:official`은 수집기 결과를 넘기지 않아 수집기별 시각·상태가 갱신되지 않는다. 건수는 W-003 이후 맞는다. 수동 명령이라 영향은 작다.

### 검증

2026-09-28 17시 KST, macOS 26.6.2, Node v20.19.0, pnpm 10.33.1.

- `node --import tsx --test tests/reclassify-news.test.ts tests/collection-run.test.ts` — 통과(17개). 새 테스트는 재분류가 뉴스를 제거할 때 naver 건수만 다시 세고 다른 수집기는 그대로 두는지 본다([tests/reclassify-news.test.ts](../../tests/reclassify-news.test.ts)). 관련도 정책 파일에 기대지 않도록 이슈·인물 목록을 비웠다.
- 데이터 복사본 실행 — 통과. 위 재현과 같은 조건에서 수정 후에는 `validate:data`가 항목 7,887건으로 통과했고, 수집기별 시각·상태는 `262ca659` 값 그대로였다. 저장소 데이터는 바뀌지 않았다.
- W-003의 실제 데이터 재현(`e91e6f2`, `f35c4b6`, 2026-11-09 시나리오 2건) — 4건 모두 통과. 재계산을 공용 함수로 옮긴 뒤에도 동작이 같다.
- `pnpm run lint`, `pnpm run typecheck` — 통과.
- `pnpm test` — 통과(360개 테스트, 71개 스위트).
- `pnpm run validate:data` — 통과(항목 7,887건).
- `pnpm run build` — 통과.
- CI(run 36498835112, `50a33372`) — 통과. lint → typecheck → test → validate:data → build, 2026-09-28 23:35~23:38 UTC.

### 세션 메모

- 2026-09-28 17:57 KST · Claude Code (Opus 5.5) — 원인 재현, 수정, 회귀 테스트, 로컬 검증까지 마쳤다. 미커밋. 다음 행동은 커밋·push 후 CI 확인이다.
- 2026-09-29 08:38 KST · Claude Code (Opus 5.5) — 사용자 승인으로 커밋·push했다(봇 커밋 위로 rebase해 `50a33372`). CI가 통과해 완료 조건을 채웠고 상태를 `완료`로 바꿨다.

## 남은 일

- [x] 데이터 복사본에서 원인 재현
- [x] 공용 건수 재계산 함수로 수정하고 회귀 테스트 추가
- [x] 로컬 검증(lint, typecheck, test, validate:data, build, 데이터 복사본 실행)
- [x] 커밋·push 후 CI 통과 확인 — `50a33372`, run 36498835112

재개에 필요한 코드 상태: 해당 없음. 수정은 `50a33372`로 `main`에 반영됐다. 후속으로 볼 것이 생긴다면 `reclassify:news`의 dry-run 여부다(위 관찰). 요청이 있을 때 새 작업으로 다룬다.
