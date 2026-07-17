# 잔여 작업

작성일: 2026-07-17

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

## 2. 홈서버 첫 배포 확인

Porkbun 도메인 구매, Cloudflare DNS 위임과 Tunnel public hostname 설정은 저장소 밖 작업이다. `docs/home-server-deployment.md` 절차를 완료한 뒤 실제 공개 URL에서 주요 라우트가 정상 렌더링되는지 확인해야 한다.

확인할 라우트:

- `/`
- `/news`
- `/youtube`
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

## 3. YouTube API 첫 수집과 90일 백필 확인

GitHub 저장소 시크릿 `YOUTUBE_API_KEY`를 등록한 뒤
`Collect Korea Football Radar YouTube Data` 워크플로를 수동 실행해야 한다. 첫 실행은
최근 90일을 검색하되 검색어별 최대 2페이지로 쿼터를 제한한다. 100건을 넘는 검색어의
과거 구간을 더 채워야 하면 workflow dispatch의 `published_after`, `published_before`로
기간을 나눠 추가 실행한다.

배포 순서는 새 item schema와 화면 코드가 포함된 홈서버 image를 먼저 배포한 뒤,
`YOUTUBE_API_KEY`를 등록하고 첫 수집을 실행한다. 코드 배포 전에 유튜브 항목을 R2에
발행하면 이전 앱은 새 `youtube` 유형을 해석할 수 없다.

확인할 것:

- Shorts가 포함되는지
- 라이브·예약·라이브 다시보기가 제외되는지
- `/youtube`에 썸네일, 채널, 재생 시간이 표시되는지
- `/`, `/tracking`, `/sources`에 유튜브 항목과 통계가 반영되는지
- 09:17, 21:17(KST) 예약 실행이 성공하는지

명령:

```bash
gh workflow run "Collect Korea Football Radar YouTube Data"
gh run list --workflow "Collect Korea Football Radar YouTube Data" --limit 5
```

## 4. R2 데이터 발행 확인

[`r2-data-deployment.md`](r2-data-deployment.md)의 외부 설정을 완료한 뒤 수집 workflow가
검증 snapshot을 R2에 발행하고, 앱 재배포 없이 이를 읽는지 확인해야 한다.

확인할 것:

- GitHub Actions가 `Update radar data` 커밋을 생성하는지
- R2 `current.json`이 content-addressed snapshot을 가리키는지
- snapshot SHA-256과 byte 길이가 manifest와 일치하는지
- 공개 `/api/health`의 `data.source`가 `r2`인지
- 수집 후 앱 image를 교체하지 않아도 최근 수집 시각이 바뀌는지

최종 확인 명령:

```bash
pnpm run check:readiness -- --strict
curl --fail --silent --show-error https://k-football-radar.app/api/health
```
