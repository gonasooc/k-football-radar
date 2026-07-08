# 잔여 작업

작성일: 2026-07-08

이 문서는 코드 구현이 아니라 저장소 밖에서 확인해야 하는 실제 남은 작업만 추적한다.

## 1. GitHub Actions 수집 워크플로 검증

GitHub 저장소 시크릿 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`이 등록된 상태에서 수집 워크플로를 한 번 수동 실행해야 한다.

확인할 것:

- `Collect Korea Football Radar Data` 워크플로가 성공하는지
- 로그의 `naver candidates` 값이 시크릿 미설정 상태처럼 계속 0으로만 나오지 않는지
- 공식자료 fetch 실패가 있어도 전체 수집이 중단되지 않는지
- `data/` 변경이 있으면 `Update radar data` 커밋이 생성되는지

명령:

```bash
gh workflow run "Collect Korea Football Radar Data"
gh run list --limit 5
gh run watch <run-id> --exit-status
```

## 2. Vercel 첫 배포 확인

Vercel 프로젝트 연결은 저장소 밖 작업이다. 연결 후 실제 공개 URL에서 주요 라우트가 정상 렌더링되는지 확인해야 한다.

확인할 라우트:

- `/`
- `/feed`
- `/issues`
- `/issues/[id]`
- `/people`
- `/people/[id]`
- `/sources`

확인할 것:

- 최신 수집 시각과 통계가 보이는지
- 피드 필터와 검색이 동작하는지
- 원문 링크가 새 탭으로 열리는지
- 모바일 화면에서 텍스트와 필터 UI가 겹치지 않는지

## 3. 데이터 커밋 후 자동 재배포 확인

수집 워크플로가 `data/` 변경 커밋을 만든 뒤 Vercel이 그 push를 감지해 새 배포를 만드는지 확인해야 한다.

확인할 것:

- GitHub Actions가 `Update radar data` 커밋을 생성하는지
- Vercel deployment가 새로 생성되는지
- 공개 URL의 최근 수집 시각이 최신 `data/collection-state.json` 값으로 바뀌는지

최종 확인 명령:

```bash
pnpm run check:readiness -- --strict
```
