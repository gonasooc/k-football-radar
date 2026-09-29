# W-006 · 단독 수집의 수집기별 상태 갱신

- 상태: 진행 중
- 최근 갱신: 2026-09-29
- 관련 문서: [docs/README.md](../README.md), [docs/work/W-004-main-reclassify-news-total-sync.md](W-004-main-reclassify-news-total-sync.md), [scripts/collect-naver-news.ts](../../scripts/collect-naver-news.ts), [scripts/collect-official.ts](../../scripts/collect-official.ts), [scripts/collection-run.ts](../../scripts/collection-run.ts)

## 현재 상황

W-004에서 관찰한 문제다. `collect:naver`, `collect:official`을 단독으로 실행하면 최상위 시각·상태만 바뀌었다. `collectors.naver`·`collectors.official`의 시각·상태·신규 수는 이전 실행 값으로 남았다. 두 스크립트가 `persistCollectionRun`에 수집기 결과를 넘기지 않았기 때문이다. 넘기도록 고쳤고, 데이터 복사본에서 가짜 fetch로 실제 스크립트를 실행해 확인했다. 커밋·push와 CI 확인이 남았다.

- 완료 조건: 단독 실행 뒤 해당 수집기의 시각·상태·신규 수가 그 실행 값으로 바뀌고 `validate:data`가 통과한다(데이터 복사본에서 확인). 수정이 `main`에 반영돼 CI를 통과한다.
- 사람이 판단할 사항: 없음.

## 진행과 판단

### 배경과 범위

W-004를 닫으며 보고한 두 후속 후보 중 하나다. 다른 하나는 [docs/work/W-005-main-reclassify-news-dry-run.md](W-005-main-reclassify-news-dry-run.md)다. 2026-09-29 사용자가 두 후보를 모두 새 작업으로 진행하라고 했다. 예약 워크플로는 합친 수집([scripts/update-data.ts](../../scripts/update-data.ts))을 쓰므로 이 문제는 수동 단독 실행에만 해당한다.

### 원인

- 사실: 두 단독 스크립트는 MVP(`5e6fdf6f`, 2026-07-07)부터 있었다. 수집기별 상태(`collectors`)는 그 뒤인 2026-07-17(`fc7851f3`)에 생겼다. 이때 합친 수집과 유튜브 수집만 `collectorResults`를 넘기도록 바뀌었다.
- 사실: 데이터 복사본(`5097e49c`)에서 수정 전 코드를 실행해 재현했다.
  - `collect:naver`는 96/96 검색이 성공했다. 최상위 시각은 실행 시각으로 바뀌었지만 `collectors.naver`는 이전 실행 값(20:49:15Z, 신규 4)으로 남았다.
  - `collect:official`은 3/3 출처가 성공했지만 `collectors.official`은 이전 값(20:49:15Z, `partial`)으로 남았다.

### 결정

- 2026-09-29 — 두 `run()`이 각자의 수집기 결과(`naver`, `official`)를 넘긴다. 합친 수집과 같은 규칙을 따른다. 예를 들어 전부 실패하면 그 수집기의 마지막 성공 시각을 유지한다.
- 단위 테스트는 추가하지 않았다. 이유는 다음과 같다.
  - `run()`은 저장소 파일과 네트워크를 직접 쓴다.
  - 다른 스크립트의 `run()`도 단위 테스트 대상이 아니다.
  - 수집기 결과를 넘겼을 때의 상태 계산은 [tests/collection-run.test.ts](../../tests/collection-run.test.ts)가 이미 다룬다.
  - 대신 실제 스크립트를 데이터 복사본에서 실행해 확인했다.

### 검증

2026-09-29 08시 KST, macOS 26.6.2, Node v20.19.0, pnpm 10.33.1.

- 데이터 복사본 실행 — 통과. 수정 후 같은 조건에서 다시 실행했다.
  - `collect:naver`: `collectors.naver`가 실행 시각(23:51:44Z), `success`, 신규 0으로 바뀌었다.
  - `collect:official`: `collectors.official`이 실행 시각(23:53:33Z), `success`, 신규 0으로 바뀌었다.
  - 두 실행 모두 `validate:data`가 통과했다.
- 네트워크와 API 키는 쓰지 않았다. 가짜 fetch를 먼저 불러와 네이버 검색 96회에 빈 결과를, 공식자료 3회에 빈 HTML을 돌려줬다. 복사본은 세션 임시 폴더에 만들었고 저장소 데이터는 바뀌지 않았다.
- W-005와 함께 확인한 전체 검증 — 통과. `pnpm run lint`, `pnpm run typecheck`, `pnpm test`(361개 테스트, 71개 스위트), `pnpm run validate:data`(7,889건), `pnpm run build`.
- CI — 미실행. 아직 커밋·push하지 않았다.

### 세션 메모

- 2026-09-29 08:58 KST · Claude Code (Opus 5.5) — 원인 재현, 수정, 데이터 복사본 확인까지 마쳤다. 미커밋. 다음 행동은 커밋·push 후 CI 확인이다.

## 남은 일

- [x] 데이터 복사본에서 원인 재현
- [x] 두 단독 스크립트가 수집기 결과를 넘기도록 수정
- [x] 데이터 복사본에서 수정 확인
- [ ] 커밋·push 후 CI 통과 확인

재개에 필요한 코드 상태: `main`, HEAD `5097e49c` 위의 미커밋 변경 — [scripts/collect-naver-news.ts](../../scripts/collect-naver-news.ts), [scripts/collect-official.ts](../../scripts/collect-official.ts), 문서(이 파일, [docs/README.md](../README.md)).
