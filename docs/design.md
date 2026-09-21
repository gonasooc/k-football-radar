# UI 디자인 기준

UI의 시각적 기준과 상호작용·반응형·접근성 기준을 다룹니다. 시스템 구조는 [docs/architecture.md](architecture.md), 기술 스택·도구 설정·검증 명령은 [docs/specs.md](specs.md)에서 관리합니다.

이 프로젝트의 디자인 기준 원본은 저장소 루트에 있습니다. 이 문서는 그 문서들과 실제 코드의 관계를 정리한 진입점이며, 토큰 값이나 컴포넌트 목록 전체를 다시 복제하지 않습니다.

## 참고할 코드와 화면

확인 범위: 2026-09-21에 코드와 설정만 읽었다. 렌더링된 화면은 이번에 확인하지 않았으므로 아래 ‘관찰된 구현’은 코드 근거에 한정된다.

같은 날 코드와 어긋나던 기준 문서를 코드에 맞춰 현행화하고 다크 테마 기준을 [DESIGN.md](../DESIGN.md)에 추가했다. 코드는 바꾸지 않았다([docs/work/W-001-main-docs-structure.md](work/W-001-main-docs-structure.md)).

기준 문서:

- [DESIGN.md](../DESIGN.md): 디자인 시스템 원본. 색상·타이포그래피·모서리·간격 토큰과 컴포넌트 규칙
- [PRODUCT.md](../PRODUCT.md): 사용자, 브랜드 성격, 안티레퍼런스, 디자인 원칙, 접근성 목표
- [.impeccable.md](../.impeccable.md): 디자인 작업용 한국어 컨텍스트 요약

원본 코드:

- [app/globals.css](../app/globals.css): 테마 토큰(CSS 변수)과 공통 유틸리티
- [tailwind.config.ts](../tailwind.config.ts): 토큰을 Tailwind 색상·그림자·모서리로 노출
- [app/layout.tsx](../app/layout.tsx): 마스트헤드, 테마 초기화 스크립트, 건너뛰기 링크, 메타데이터
- [components/AppNav.tsx](../components/AppNav.tsx): 데스크톱 상단 내비게이션과 모바일 하단 고정 내비게이션
- [components/ItemCard.tsx](../components/ItemCard.tsx), [components/StoryFeedEntryCard.tsx](../components/StoryFeedEntryCard.tsx), [components/YouTubeCard.tsx](../components/YouTubeCard.tsx): 기사·묶음·영상 카드
- [components/ThemeToggle.tsx](../components/ThemeToggle.tsx): 라이트·다크 전환

## 관찰된 구현

- 색상은 `app/globals.css`의 CSS 변수에 `L C H` 삼항으로 두고 `oklch(var(--x) / <alpha-value>)`로 감싸 Tailwind 색상으로 노출한다. 라이트가 기본이고 `:root[data-theme="dark"]`가 전체 팔레트를 뒤집는다.
- 테마 전환은 `ThemeToggle`이 `data-theme`, `color-scheme`, `theme-color` 메타를 함께 바꾸고 `localStorage`에 저장한다. 첫 페인트 전에 `app/layout.tsx`의 인라인 스크립트가 저장값 또는 `prefers-color-scheme`을 적용한다. 전환 애니메이션은 `prefers-reduced-motion`을 확인한 뒤에만 붙인다.
- 타이포그래피는 Pretendard Variable 동적 서브셋 한 종류이며, `body`에 `tnum`·`ss01` 폰트 기능을 켜고 숫자 열에는 `metric-tabular`를 쓴다.
- 모서리는 `chip 3px / control 4px / panel 6px`, 그림자는 `panel`과 `lift` 두 가지만 정의되어 있다.
- 내비게이션은 두 벌이다. `sm` 이상에서는 상단 가로 메뉴, 그 미만에서는 하단 고정 5탭이며 `env(safe-area-inset-bottom)`을 반영한다. 활성 항목은 accent 테두리와 진한 글자, `aria-current="page"`로 표시한다.
- 터치 영역은 링크·컨트롤에 `min-h-11`(44px), 하단 탭에 `min-h-14`를 적용한다.
- 접근성 장치로 `본문으로 건너뛰기` 링크, `focus-ring`(accent outline, offset 2), 아이콘 버튼의 `aria-label`, 섹션의 `aria-labelledby`를 사용한다.
- 기사 카드 변형은 `row`와 `compact` 둘이다. 태그 노출 한도는 각각 6개와 4개이고, 홈은 상위 3건과 다음 3건을 모두 `compact`로 배치한다(`components/HomeFeedSection.tsx`).
- 목록 항목에 `content-visibility: auto`와 `contain-intrinsic-size`를 적용해 긴 피드의 렌더링 비용을 줄인다.
- 헤더 로고는 다크 테마에서 `invert`와 `hue-rotate`로 반전한다. 원격 이미지는 유튜브 썸네일(`i.ytimg.com`)만 허용한다.

## 합의된 디자인 기준

아래는 [DESIGN.md](../DESIGN.md)와 [PRODUCT.md](../PRODUCT.md)에 이미 합의되어 있는 기준의 요약이다. 값과 세부 규칙은 원본을 따른다.

- 시각적 방향과 레이아웃: “The Football Front Page”. 밝은 종이색 바탕, 얇은 룰, 강한 Pretendard 제목, 중앙 마스트헤드와 섹션 내비게이션으로 신문 1면의 리듬을 만든다. 어두운 히어로, 네온 점수판, 장식적 그라데이션, 반복되는 둥근 카드 그리드를 쓰지 않는다. 붉은 accent는 작은 편집 표식으로만 쓴다.
- 공통 컴포넌트와 상태: 컨트롤은 44px 이상 높이와 4px 모서리, 칩은 3px, 기사 블록은 기본적으로 모서리를 두지 않는다. 면을 나눌 때 그림자보다 1px 룰을 먼저 쓴다. 모든 제목이 원문 링크이며 같은 항목에 중복 CTA를 두지 않는다.
- 테마: 라이트가 기본이고 같은 토큰 이름으로 전체 다크 팔레트를 제공한다. 컴포넌트는 테마를 분기하지 않고 토큰만 쓰며, 새 색은 라이트·다크 양쪽에 함께 추가한다. 다크에서도 붉은 accent는 면이 아니라 표식으로만 쓴다. 기준은 [DESIGN.md](../DESIGN.md)의 ‘Dark Theme’ 절에 있다.
- 반응형과 접근성: 다섯 목적지는 모바일에서도 44px 이상 터치 영역으로 유지한다. 텍스트와 컨트롤은 WCAG AA 대비를 목표로 하고, 뉴스·공식자료 구분을 색에만 의존하지 않는다. 한국어 본문을 읽기 어려운 크기로 줄이지 않고, 뷰포트 비례 타이포그래피로 모바일 넘침을 만들지 않는다.
- 언어: 시각적 위계로 중요도를 표현하되 라벨과 문구는 중립을 유지한다.

## 불일치와 미정 사항

2026-09-21에 아래 네 건을 문서 현행화로 정리했다. 코드는 바꾸지 않았다.

- 해소 — 다크 테마 기준을 [DESIGN.md](../DESIGN.md)에 ‘Dark Theme’ 절로 추가했다. 다크 팔레트 전체, 토큰 운영 규칙, 사전 적용 스크립트와 `prefers-reduced-motion` 조건, 두 테마 모두 WCAG AA를 목표로 한다는 기준을 담았다. `app/globals.css`에만 있던 `summary`와 `shadow` 토큰도 문서에 추가했다.
- 해소 — 라이브 영상 문장을 현재 동작에 맞췄다. 라이브·예약·라이브 다시보기는 일반 영상과 같은 규칙으로 수집·노출한다(`tests/youtube.test.ts`의 “excludes confirmed Shorts while keeping scheduled, active, and completed live videos”).
- 해소 — `lead` 카드 변형과 2.25rem Lead Headline은 코드에 없다. 문서를 `row`·`compact` 두 변형과 실제 타이포그래피 단계(페이지 제목 1.5→1.875rem, 기사 제목 1.25→1.375rem, 본문 0.875rem, 메타 0.75rem, 라벨 0.6875rem·0.14em)로 고쳤다. 마스트헤드가 로고 이미지라 3rem·2.25rem 단계는 쓰이지 않는다는 점도 적었다.
- 해소 — 디자인 문서 3종의 역할을 나눴다. [DESIGN.md](../DESIGN.md)가 토큰·컴포넌트 기준의 원본, [PRODUCT.md](../PRODUCT.md)가 사용자·브랜드 톤과 안티레퍼런스, [.impeccable.md](../.impeccable.md)가 디자인 작업용 한국어 요약, 이 문서가 코드와의 관계를 정리한 진입점이다. 통합은 하지 않는다. 기준값이 바뀌면 `DESIGN.md`를 먼저 고치고 나머지를 맞춘다.

남은 미확인 사항:

- 실제 렌더링 화면, 브라우저별 표시, 대비 측정값은 확인하지 않았다. 특히 다크 테마의 summary·muted 텍스트가 Panel·Paper 위에서 AA를 만족하는지는 측정이 필요하다. 미확인.
- `DESIGN.md` frontmatter에 다크 팔레트를 `colorsDark` 키로 추가했다. 기존 `colors` 키와 같은 형식이지만 도구가 이 키를 읽는지는 확인하지 않았다. 미확인.

## 디자인 확인 방법

UI를 바꾼 뒤에는 `pnpm run dev`로 띄워 아래를 확인하고, 실제 확인 결과와 미확인 범위는 해당 작업 문서에 남긴다.

- 화면: `/`, `/news`, `/youtube`, `/tracking`(이슈·인물 탭), `/issues/[id]`, `/people/[id]`, `/sources`
- 폭: 모바일(하단 고정 내비게이션이 보이는 `sm` 미만)과 데스크톱 각각
- 테마: 라이트와 다크 양쪽에서 대비와 로고 반전
- 상태: 기본·호버·포커스(키보드 Tab)·로딩·빈 목록·오류
- 동작: 검색과 필터, 더보기, 원문 링크가 새 탭으로 열리는지, 긴 한국어 제목이 넘치지 않는지
