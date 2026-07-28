# 잔여 작업과 운영 점검

최종 확인일: 2026-07-28

이 문서는 코드 구현이 아니라 저장소 밖에서 확인해야 하는 작업만 추적한다.

## 1. 현재 잔여 작업

없다. MVP와 YouTube 확장, R2 데이터 발행, 홈서버 배포의 외부 설정이 모두 끝났고
운영 중이다.

2026-07-28 확인 결과:

- `https://k-football-radar.app/api/health`가 200을 반환하고 `data.source`가 `r2`,
  `data.stale`이 `false`다.
- `Collect Korea Football Radar Data`와
  `Collect Korea Football Radar YouTube Data`가 예약 실행으로 계속 성공하고 있다.
- 수집 결과가 `Update radar data` / `Update YouTube radar data` 커밋으로 쌓이고,
  같은 실행에서 R2 snapshot이 발행된다.
- 앱 image를 교체하지 않아도 health의 수집 시각이 갱신된다.

새 외부 작업이 생기면 이 절에 추가하고, 끝나면 지운다.

## 2. 정기 점검

주기적으로 또는 배포 전에 확인한다.

```bash
pnpm run check:readiness -- --strict
curl --fail --silent --show-error https://k-football-radar.app/api/health
```

`check:readiness`는 GitHub 시크릿·변수와 최신 CI·수집 워크플로 결과를 확인한다.
확인 항목은 [전체 작동 구조](system-overview.md)의 "준비 상태 확인"에 정리되어 있다.

확인할 것:

- health의 `data.source`가 `r2`이고 `data.stale`이 `false`인지
- health의 수집 시각이 R2 `current.json`의 `collectedAt`과 같은지
- 수집 워크플로 로그의 `naver candidates`가 계속 0으로만 나오지 않는지
- 공식자료 fetch 실패가 있어도 전체 수집이 중단되지 않는지

## 3. 코드 배포 후 확인

앱 image를 새로 배포했을 때만 필요하다. 수집 데이터 변경은 R2로 반영되므로
이 절차가 필요하지 않다.

확인할 라우트:

- `/`
- `/news`
- `/youtube`
- `/tracking`
- `/issues/[id]`
- `/people/[id]`
- `/sources`

확인할 것:

- 최신 수집 시각과 통계가 보이는지
- 피드 필터, 검색, 더보기가 동작하는지
- 원문 링크가 새 탭으로 열리는지
- 모바일 화면에서 텍스트와 필터 UI가 겹치지 않는지

## 4. YouTube 과거 구간 추가 수집

필요할 때만 하는 선택 작업이다. 기본 수집은 검색어별 최대 2페이지로 쿼터를
제한하므로, 100건을 넘는 검색어의 과거 구간을 더 채우려면 workflow dispatch의
`published_after`, `published_before`로 기간을 나눠 추가 실행한다.

```bash
gh workflow run "Collect Korea Football Radar YouTube Data" \
  -f published_after=2026-01-01T00:00:00Z \
  -f published_before=2026-02-01T00:00:00Z
```
