# 프로젝트 문서

## 현재 상황

Korea Football Radar는 한국 축구 거버넌스 관련 뉴스·공식자료와 유튜브 영상의 메타데이터를 GitHub Actions로 수집해 `data/`에 커밋하고, 검증한 snapshot을 Cloudflare R2로 발행해 맥미니 홈서버의 Next.js 앱이 읽는 공개 서비스다. 수집·발행 자동화와 홈서버 배포까지 끝나 운영 중이며, 2026-08-06 이후 코드 변경 없이 수집 데이터 커밋만 쌓이고 있다.

2026-09-21 기준 당분간 기능을 늘리지 않고 유지보수만 한다. 같은 날 보존 상한을 6,000 / 3,400 / 1,200으로 올리고 밀려났던 보조 뉴스 2,701건을 복구해 저장 항목이 7,744건이 됐다. 열려 있는 작업은 없다.

## 기본 문서

- [docs/plan.md](plan.md): 제품 목적, 사용자, 기능 범위, 사용자 흐름, 제품 정책
- [docs/architecture.md](architecture.md): 구성 요소, 폴더 책임, 의존 관계, 구조 규칙
- [docs/specs.md](specs.md): 기술 스택, 구현 규칙, 실행·검증 방법

제품 기획 → 구조 → 구현 규칙 순으로 안내합니다. 매 작업마다 전부 읽을 필요는 없으며, 현재 작업에 필요한 문서를 선택합니다.

## 선택 문서

- [docs/design.md](design.md): UI 디자인 기준, 관찰된 구현, 코드·화면 근거

UI를 추가·수정·검토하기 전에 관련 부분을 확인합니다. 이 프로젝트의 디자인 원본 기준은 저장소 루트의 [DESIGN.md](../DESIGN.md), [PRODUCT.md](../PRODUCT.md), [.impeccable.md](../.impeccable.md)에 있고, `docs/design.md`는 그 문서들과 실제 코드의 관계를 정리한 진입점입니다.

## 기존 프로젝트 문서

이 구조를 적용하기 전부터 있던 문서이며 그대로 유지합니다. 기본 문서보다 자세한 내용이 필요할 때 봅니다.

- [docs/mvp-plan.md](mvp-plan.md): MVP 기획서와 YouTube 확장 확정안, 데이터 모델과 완료 기준
- [docs/system-overview.md](system-overview.md): 수집·분류·묶음·저장·배포로 이어지는 전체 작동 구조
- [docs/r2-data-deployment.md](r2-data-deployment.md): R2 snapshot 발행과 런타임 조회, 실패·복구 절차
- [docs/home-server-deployment.md](home-server-deployment.md): 맥미니 릴리스 빌드·선택·배포와 도메인 설정
- [README.md](../README.md): 저장소 소개, 명령 목록, 수집·운영 요약

## 진행 중·예정·보류 작업

등록된 작업이 없습니다.

상태는 `예정`, `진행 중`, `보류`, `완료`를 사용합니다. 새 작업은 [docs/work/_template.md](work/_template.md)를 복사해 `W-번호-생성당시브랜치-주제.md`로 저장하고 이 목록에 연결합니다. 상세 내용은 작업 문서에서 관리합니다.

## 최근 완료

- [docs/work/W-001-main-docs-structure.md](work/W-001-main-docs-structure.md) — docs-starter 문서 구조 적용 — 2026-09-21 완료
- [docs/work/W-002-main-item-retention-review.md](work/W-002-main-item-retention-review.md) — 보존 상한 인상과 과거 보조 뉴스 복구 — 2026-09-21 완료

완료 후에도 원래 작업 문서를 보존하고 링크를 이곳으로 옮깁니다.

## 기록을 찾을 때

작업 문서의 ‘현재 상황’과 ‘남은 일’의 미완료 항목부터 읽으세요. 완료한 항목은 체크된 상태로 남아 있습니다. 보류 이유와 재개 조건은 ‘현재 상황’에, 선택한 이유와 검증 결과는 ‘진행과 판단’에 있습니다. 상세 세션 기록이 있으면 해당 작업 문서에서 연결합니다.

문서 작성·갱신 규칙은 [AGENTS.md](../AGENTS.md)를 참고하세요.
