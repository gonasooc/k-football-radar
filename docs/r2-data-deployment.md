# R2 데이터 배포

수집 데이터는 Git 이력에도 남기지만, 운영 앱은 Docker image 안의 `data/`가 아니라
Cloudflare R2의 최신 검증 스냅샷을 읽는다. 따라서 수집 결과가 바뀔 때 앱 image를
다시 만들지 않는다.

## 데이터 흐름

```text
GitHub Actions 수집
        ↓
data/ 갱신 및 validate:data
        ↓
Git commit / push
        ↓
전체 DataBundle 직렬화 및 SHA-256 계산
        ↓
R2 snapshots/<SHA-256>.json 업로드
        ↓
크기와 checksum metadata 확인
        ↓
R2 current.json 교체
        ↓
홈서버가 최대 60초 cache로 최신 snapshot 조회
```

`snapshots/<SHA-256>.json`은 내용이 바뀌지 않는 immutable object다. `current.json`은
현재 사용할 snapshot의 object key, 수집 시각, byte 수, SHA-256을 담는다. 새 snapshot
업로드와 확인이 끝난 뒤에만 `current.json`을 교체하므로 앱이 일부만 올라간 데이터를
읽지 않는다.

## 외부 리소스

권장 이름은 다음과 같다.

```text
R2 bucket: k-football-radar-data
R2 custom domain: data.k-football-radar.app
```

R2 bucket은 공개 읽기를 custom domain에만 연결한다. GitHub Actions용 R2 S3 API
token은 이 bucket의 object 읽기와 쓰기만 허용한다. access key와 secret key는 로컬
파일이나 Git에 저장하지 않는다.

GitHub repository에는 다음 값을 등록한다.

```text
Variables:
  CLOUDFLARE_ACCOUNT_ID
  R2_BUCKET_NAME

Secrets:
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
```

홈서버의 ignored private 파일 `deploy/macos/production.env`에는 다음 값을 추가한다.

```text
K_FOOTBALL_RADAR_DATA_BASE_URL=https://data.k-football-radar.app
```

## 최초 전환 순서

1. R2 bucket을 만든다.
2. `data.k-football-radar.app` custom domain을 bucket에 연결한다.
3. `snapshots/` prefix에 오래된 object를 삭제하는 lifecycle rule을 설정한다. 기본
   보존 기간은 90일이다. `current.json`은 이 prefix 밖에 있어 삭제되지 않는다.
4. bucket 범위 R2 S3 API token을 만들고 GitHub Variables와 Secrets를 등록한다.
5. 마이그레이션 코드가 `main`에 반영된 뒤 수집 workflow를 수동 실행한다.
6. `https://data.k-football-radar.app/current.json`과 그 안의 snapshot URL이 정상
   응답하는지 확인한다.
7. 홈서버 `production.env`에 data base URL을 추가하고 앱을 한 번 배포한다.
8. 공개 `/api/health` 응답의 `data.source`가 `r2`이고 수집 시각이 R2
   `current.json`과 같은지 확인한다.

## 런타임 동작

`lib/remote-data.ts`는 `current.json`을 확인한 뒤 가리키는 snapshot을 내려받는다.
byte 길이, SHA-256, object key, 수집 시각, Zod schema와 데이터 간 참조 무결성을 모두
검증한 값만 cache한다.

정상 snapshot은 프로세스 안에서 60초 cache한다. cache 갱신 때 R2가 일시적으로
실패하면 마지막 정상 snapshot을 계속 제공하고 health 응답에 `stale: true`와 오류를
표시한다. 프로세스 시작 후 첫 R2 요청부터 실패하면 `/api/health`는 503을 반환한다.
60초마다 작은 `current.json`만 다시 확인하고 SHA-256이 달라졌을 때만 전체 snapshot을
다시 내려받는다.

## 수집 실패와 복구

- 수집 또는 `validate:data`가 실패하면 R2 발행 단계에 도달하지 않는다.
- snapshot 업로드가 실패하면 `current.json`을 바꾸지 않는다.
- 이미 존재하는 동일 SHA-256 snapshot은 덮어쓰지 않고 검증 후 재사용한다.
- Git push는 성공했지만 R2 발행이 실패하면 workflow가 실패한다. 다음 수동 또는 예약
  실행은 현재 Git 데이터를 다시 발행할 수 있다.
- 잘못된 최신 snapshot을 되돌려야 하면 검증된 이전 snapshot을 가리키는
  `current.json`을 다시 발행한다.

## 코드와 데이터 배포의 분리

```text
수집 데이터 변경 → GitHub Actions가 R2 발행 → 최대 약 60초 후 서비스 반영
앱 코드 변경     → Docker image build/select/deploy
```

운영 image에는 `data/`를 복사하지 않는다. 운영 환경에 `RADAR_DATA_BASE_URL`이 없으면
앱은 내장 데이터로 조용히 돌아가지 않고 데이터 설정 오류로 실패한다. 로컬 개발과
테스트는 기존 저장소의 `data/`를 사용한다.
