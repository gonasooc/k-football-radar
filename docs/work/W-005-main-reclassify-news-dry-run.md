# W-005 · 뉴스 재분류 dry-run 도입

- 상태: 완료
- 최근 갱신: 2026-09-29
- 관련 문서: [docs/README.md](../README.md), [docs/work/W-004-main-reclassify-news-total-sync.md](W-004-main-reclassify-news-total-sync.md), [scripts/reclassify-news.ts](../../scripts/reclassify-news.ts), [docs/specs.md](../specs.md)

## 현재 상황

W-004에서 관찰한 불일치를 해소하는 작업이다. `pnpm run reclassify:news`는 실행하면 바로 데이터를 고쳐 썼지만, [docs/specs.md](../specs.md)와 [AGENTS.md](../../AGENTS.md)는 이 명령에 dry-run이 있는 것처럼 적고 있었다. `reclassify:youtube`와 같은 방식으로 기본 dry-run을 넣었고, 데이터 복사본에서 세 가지 실행 방식을 확인했다. `6a0f6044`로 `main`에 반영했고 CI가 통과해 완료했다.

- 완료 조건: 기본 실행은 데이터를 바꾸지 않고 보고서만 만들며, `--apply --confirm`일 때만 적용한다. 수정이 `main`에 반영돼 CI를 통과한다. — 충족
- 사람이 판단할 사항: 없음.

## 진행과 판단

### 배경과 범위

W-004를 닫으며 두 가지 후속 후보를 보고했다. 하나는 dry-run 추가이고, 다른 하나는 [docs/work/W-006-main-standalone-collector-state.md](W-006-main-standalone-collector-state.md)다. dry-run 쪽은 "추가"와 "문서를 현재 동작에 맞춤" 두 선택지를 제시하고 추가를 권했다. 2026-09-29 사용자가 두 후보를 모두 새 작업으로 진행하라고 해, 권고안대로 dry-run을 추가했다. 저장소 데이터에는 실행하지 않았다.

### 결정

- 2026-09-29 — [scripts/reclassify-youtube.ts](../../scripts/reclassify-youtube.ts), [scripts/restore-evicted-news.ts](../../scripts/restore-evicted-news.ts)와 같은 방식을 따랐다.
  - `--apply`가 없으면 보고서만 쓰고, `--apply`에는 `--confirm`이 필요하다.
  - 보고서는 `reports/news-reclassification-<mode>.json`이다. 제거·등급 변경 대상을 항목 ID로만 기록한다. `reports/`는 Git에 커밋되는 경로라 기사 제목·실명을 남기지 않는다.
- 적용 보고서는 데이터 저장이 끝난 뒤에 쓴다. 저장이 실패해 되돌린 변경을 보고서가 설명하지 않게 하려는 것이다. 다른 두 스크립트는 적용 전에 보고서를 쓰지만, 이번 범위에서 바꾸지 않았다.
- 문서도 맞췄다.
  - [README.md](../../README.md)의 명령 설명에 dry-run과 적용 방법을 적었다.
  - [docs/system-overview.md](../system-overview.md)의 `reports/` 설명에 `reclassify:news`와 `restore:news`를 넣었다.
  - [docs/specs.md](../specs.md)의 dry-run 규칙 예시에 두 스크립트를 넣었다.
  - [AGENTS.md](../../AGENTS.md)는 이제 사실과 맞아 그대로 두었다.

### 검증

2026-09-29 08시 KST, macOS 26.6.2, Node v20.19.0, pnpm 10.33.1.

- `node --import tsx --test tests/reclassify-news.test.ts` — 통과(2개). 새 테스트는 보고서가 제거·승격·강등을 ID로 나누고 다른 출처는 세지 않는지 본다([tests/reclassify-news.test.ts](../../tests/reclassify-news.test.ts)).
- 데이터 복사본 실행 — 통과. `5097e49c` 데이터에 현재 규칙이 제거하는 뉴스 1건을 넣고 세 가지로 실행했다.
  - 기본 실행: `News reclassification dry-run: 7341 -> 7340 news, 1 removed, 0 promoted, 0 demoted`. 데이터 checksum이 그대로였고 보고서의 `removed`는 `item_synthetic_weather` 한 건이었다.
  - `--apply`만: `Applying news reclassification requires --confirm`으로 종료 코드 1, 데이터 그대로.
  - `--apply --confirm`: 적용하고 apply 보고서를 썼으며 `validate:data`가 항목 7,889건으로 통과했다.
  - 복사본은 세션 임시 폴더에 만들었고 저장소의 `data/`·`reports/`는 바뀌지 않았다.
- W-006과 함께 확인한 전체 검증 — 통과. `pnpm run lint`, `pnpm run typecheck`, `pnpm test`(361개 테스트, 71개 스위트), `pnpm run validate:data`(7,889건), `pnpm run build`, W-003 실제 데이터 재현 4건.
- CI(run 36501036763, `bd83bac5`) — 통과. lint → typecheck → test → validate:data → build, 2026-09-29 00:01~00:04 UTC. 이 작업의 커밋 `6a0f6044`를 포함한 HEAD 기준이다.

### 세션 메모

- 2026-09-29 08:58 KST · Claude Code (Opus 5.5) — 구현, 테스트, 데이터 복사본 확인, 문서 갱신까지 마쳤다. 미커밋. 다음 행동은 커밋·push 후 CI 확인이다.
- 2026-09-29 09:05 KST · Claude Code (Opus 5.5) — 사용자 승인으로 `6a0f6044`를 커밋·push했다. CI가 통과해 완료 조건을 채웠고 상태를 `완료`로 바꿨다.

## 남은 일

- [x] dry-run·`--apply --confirm` 구현과 보고서 테스트 추가
- [x] 데이터 복사본에서 세 가지 실행 방식 확인
- [x] README·system-overview·specs 갱신
- [x] 커밋·push 후 CI 통과 확인 — `6a0f6044`, run 36501036763

재개에 필요한 코드 상태: 해당 없음. 수정은 `6a0f6044`로 `main`에 반영됐다.
