# W-003 · 수집기별 건수 동기화

- 상태: 완료
- 최근 갱신: 2026-09-28
- 관련 문서: [docs/README.md](../README.md), [docs/work/W-002-main-item-retention-review.md](W-002-main-item-retention-review.md), [scripts/collection-run.ts](../../scripts/collection-run.ts), [lib/validation.ts](../../lib/validation.ts)

## 현재 상황

유튜브 수집 워크플로가 `validate:data`에서 `collection-state naver totalItems=… does not match items=…`로 간헐적으로 실패했다(2026-08-27부터 6회, 최근 09-26·27·28). 저장할 때 보존 정책은 모든 유형을 90일 창으로 정리하는데, 수집기별 `totalItems`는 이번에 돈 수집기만 다시 셌기 때문이다. 세 수집기의 `totalItems`를 모두 저장 항목에서 다시 세도록 고쳐 `421836bf`로 `main`에 반영했다. 뉴스 2건이 창을 벗어나는 시점에 유튜브 수집을 수동 실행해 통과를 확인했다(옛 코드라면 실패할 조건). 이어서 뉴스 수집도 수동 실행해 통과를 확인하고 완료했다.

- 완료 조건: 수정이 `main`에 반영된 뒤 유튜브 수집과 뉴스 수집 실행이 각각 한 번 이상 `validate:data`를 통과한다. — 충족
- 사람이 판단할 사항: [scripts/reclassify-news.ts](../../scripts/reclassify-news.ts)의 같은 문제를 후속 작업으로 고칠지. 이 작업의 완료 조건과는 별개다.

## 진행과 판단

### 배경과 범위

최근 실패한 GitHub Actions 3건의 로그 분석을 요청받아 원인을 확인했고, 이어서 수정을 요청받았다. 범위는 수집 실행(`persistCollectionRun`)이 쓰는 `data/collection-state.json`의 수집기별 건수다. 데이터 파일은 바꾸지 않았다.

### 원인

- 사실: [scripts/collection-run.ts](../../scripts/collection-run.ts)의 `prepareCollectionRun`은 저장 전에 모든 항목에 `applyItemRetentionPolicy`를 적용한다. 그런데 `updateCollectorStates`는 `collectorResults`에 넘긴 수집기만 `totalItems`를 다시 셌다. 유튜브 실행은 `youtube`만, 뉴스 실행([scripts/update-data.ts](../../scripts/update-data.ts))은 `naver`·`official`만 넘긴다.
- 사실: 마지막 뉴스 수집 뒤 90일 창을 벗어난 주요 뉴스가 유튜브 실행에서 지워지고 `collectors.naver.totalItems`는 그대로 남는다. 그래서 [lib/validation.ts](../../lib/validation.ts)의 수집기별 비교에서 실패한다. 실패한 실행은 커밋·발행 전에 멈추므로 저장소 데이터는 손상되지 않았다.
- 사실: 실패한 커밋의 데이터에 로그의 저장 시각으로 보존 정책을 다시 적용하자 건수가 모두 맞았다. 08-27·09-07은 당시 상한(4,000 / 700 / 500)으로 재현했다.

| 유튜브 실행 (UTC) | 마지막 뉴스 수집 후 | 창을 벗어난 뉴스 | 결과 |
| --- | --- | --- | --- |
| 08-27 09:53 | 8.8시간 | 9건 (5/29 발행) | 실패 (4256→4247) |
| 09-07 04:45 | 3.5시간 | 1건 | 실패 (4513→4512) |
| 09-21 05:00 | 4.5시간 | 1건 | 실패 (4539→4538) |
| 09-26 16:26 | 3.1시간 | 1건 | 실패 (7371→7370) |
| 09-27 05:22 | 3.6시간 | 2건 | 실패 (7366→7364) |
| 09-27 17:01 | 2.7시간 | 0건 | 성공 |
| 09-28 05:28 | 5.5시간 | 2건 | 실패 (7343→7341) |

- 사실: 유튜브 수집 실행 이력 154건(2026-07-17~) 중 이 오류는 위 6건이다. 07-20 실패는 `collection-state.json` rebase 충돌로 원인이 다르다. W-002 상한 변경(`10c39b2e`, 2026-09-21 15:03 KST)보다 앞선 실패가 있으므로 W-002가 원인은 아니다.
- 사실: 예약 실행이 늦어 두 실행 사이가 벌어진다. 유튜브는 cron보다 약 5시간 늦게 시작하고, 뉴스는 최근 33일간 200회(하루 약 6회)만 돌았다.
- 정정: 첫 분석에서 "9/21이 처음"이라고 했으나, 실행 이력을 끝까지 확인해 08-27부터였음을 확인했다.

### 방치했을 때 예상 (추정)

`main`(`378e1617`) 데이터 기준이다.

- 창을 벗어나는 주요 뉴스는 09-28~10-03에 하루 3~13건이지만, 10-04~10-18에는 하루 10~278건이고 15일 중 9일이 85건을 넘는다. 실행 간격이 3~5시간이면 유튜브 실행이 거의 매번 실패하게 된다.
- 가장 오래된 영상(2026-08-10 14:30 UTC 발행)이 창을 벗어나는 2026-11-08부터는 뉴스 실행도 `youtube` 건수로 실패한다. 2026-11-09 시각으로 재현하자 뉴스 실행은 `youtube totalItems=541 does not match items=532`, 유튜브 실행은 `naver` 불일치로 둘 다 실패했다. 실패하면 커밋이 없어 간격이 계속 벌어지므로 두 수집기가 서로를 막는 상태가 이어진다.

### 결정

- 2026-09-28 — `updateCollectorStates`가 이번 실행 결과를 반영하기 전에, 저장 상태에 있는 수집기의 `totalItems`를 모두 최종 항목에서 다시 센다. 시각·상태·신규 수는 각 수집기의 마지막 실행 값을 유지한다. [scripts/restore-evicted-news.ts](../../scripts/restore-evicted-news.ts)가 이미 같은 원칙(건수만 옮기고 시각·상태는 유지)을 쓴다. 검증은 실제 불일치를 잡은 것이므로 완화하지 않았다.
- 같은 수정으로 `collectorResults` 없이 부르는 단독 실행(`collect:naver`, `collect:official`)의 건수도 맞게 된다.
- 관찰(범위 밖): [scripts/reclassify-news.ts](../../scripts/reclassify-news.ts)는 최상위 `totalItems`만 고치고 `collectors.naver.totalItems`는 그대로 둔다. 재분류로 뉴스가 `reject`되면 같은 검증 실패가 난다. 수동 명령이라 이번에는 고치지 않았다.
- 구현 규칙은 [docs/specs.md](../specs.md)의 ‘지켜야 할 구현 규칙’에 한 줄로 남겼다.

### 검증

2026-09-28 17시 KST, macOS 26.6.2, Node v20.19.0, pnpm 10.33.1.

- `node --import tsx --test tests/collection-run.test.ts` — 수정 전 코드에서 새 테스트 2건 실패(14/16), 수정 후 16/16 통과. 새 테스트는 유튜브 실행이 창을 벗어난 뉴스를 지우는 경우와 수집기 결과 없이 실행하는 경우다([tests/collection-run.test.ts](../../tests/collection-run.test.ts)).
- 실제 데이터 재현 — 통과.
  - 실패 커밋 `e91e6f2`·`f35c4b6`의 데이터로 유튜브 실행을 재현했다.
  - `378e1617` 데이터로 2026-11-09 시각의 뉴스·유튜브 실행을 재현했다.
  - 둘 다 `prepareCollectionRun` → `validateDataBundle` 순서다. 수정 전에는 로그와 같은 오류와 예상한 `youtube` 오류가 났고, 수정 후에는 모두 통과했다.
  - 재분류 필터는 생략하고 보존 효과만 봤다. 재현 스크립트는 세션 임시 폴더에서 돌려 저장소에 남기지 않았다.
- `pnpm run lint`, `pnpm run typecheck` — 통과.
- `pnpm test` — 통과(359개 테스트, 70개 스위트).
- `pnpm run validate:data` — 통과(항목 7,887건, 묶음 848개).
- `pnpm run build` — 통과(커밋 전 확인).
- CI(run 36396394519, `421836bf`) — 통과. lint → typecheck → test → validate:data → build, 2026-09-28 08:16~08:19 UTC.
- 유튜브 수집 수동 실행(run 36396447481, 2026-09-28 08:17~08:21 UTC) — 통과.
  - dispatch 전에 저장 시점(약 08:20 UTC)에 뉴스 2건이 창을 벗어나는 것을 계산해 두었다. 옛 코드라면 `naver totalItems=7341 does not match items=7339`로 실패할 조건이다.
  - `421836b`로 동기화한 뒤 영상 3건을 병합했고, `validate:data`가 항목 7,887건으로 통과했다. `c6e6fd06`으로 커밋하고 R2 snapshot(수집 시각 08:18:58.222Z)을 발행했다.
  - 커밋된 `collection-state.json`에서 `naver.totalItems`만 7341 → 7339로 바뀌었고, naver의 시각·상태는 05:53:48Z 뉴스 실행 값 그대로였다. youtube는 541 → 543.
  - `/api/health`가 `data.source: "r2"`, `stale: false`, snapshot `2026-09-28T08:18:58.222Z`를 반환했다.
- 뉴스 수집 수동 실행(run 36397355589, 2026-09-28 08:26~08:32 UTC) — 통과.
  - `c6e6fd0`으로 동기화한 뒤 신규 1건, 전체 7,887건으로 저장했고 `validate:data`가 통과했다. `d37da09c`로 커밋하고 R2 snapshot(수집 시각 08:26:43.898Z)을 발행했다.
  - 커밋된 `collection-state.json`에서 naver·official의 시각과 신규 수만 바뀌었다. youtube의 시각·상태·신규 수·건수(08:18:58.222Z, success, 2, 543)는 그대로였다.
  - `/api/health`가 `data.source: "r2"`, `stale: false`, snapshot `2026-09-28T08:26:43.898Z`를 반환했다.

### 세션 메모

- 2026-09-28 17:05 KST · Claude Code (Opus 5.5) — 로그 분석, 원인 재현, 수정과 회귀 테스트, 로컬 검증까지 마쳤다. 미커밋. 다음 행동은 커밋·push 후 유튜브 수집 실행 확인이다.
- 2026-09-28 17:23 KST · Claude Code (Opus 5.5) — 사용자 승인으로 `421836bf`를 커밋·push했다. CI와 유튜브 수집 수동 실행이 통과해 운영 반영을 확인했다. 다음 행동은 뉴스 수집 실행 확인 후 작업 종료다.
- 2026-09-28 17:34 KST · Claude Code (Opus 5.5) — 사용자 요청으로 뉴스 수집을 수동 실행해 통과를 확인했다. 완료 조건을 채워 상태를 `완료`로 바꿨다.

## 남은 일

- [x] 실패 로그 분석과 실제 데이터로 원인 재현
- [x] 수집기별 `totalItems` 동기화 수정과 회귀 테스트 추가
- [x] 로컬 검증(lint, typecheck, test, validate:data, 실제 데이터 재현)
- [x] 커밋·push — `421836bf`
- [x] push 후 유튜브 수집 실행이 `validate:data`를 통과하는지 확인 — run 36396447481, 뉴스 2건 재계산
- [x] 같은 코드로 뉴스 수집 실행도 통과하는지 확인 — run 36397355589

재개에 필요한 코드 상태: 해당 없음. 수정은 `421836bf`로 `main`에 반영됐다. 후속으로 볼 것이 생긴다면 [scripts/reclassify-news.ts](../../scripts/reclassify-news.ts)의 `collectors.naver.totalItems` 동기화다. 요청이 있을 때 새 작업으로 다룬다.
