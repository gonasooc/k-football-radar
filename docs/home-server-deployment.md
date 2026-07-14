# 맥미니 홈서버 배포

이 앱은 자체 Compose 구성으로 실행하며, `home-server-infra`가 만든 외부 ingress
Docker network와 이미 실행 중인 공유 Cloudflare Tunnel을 사용한다. 앱은 호스트
포트를 열지 않는다.

## 릴리스

1. `main`에 배포할 commit을 push한다. 수집 workflow가 `data/`를 갱신한 commit도
   별도 릴리스가 필요하다.
2. 맥미니에서 clean worktree인지 확인한 뒤 immutable image를 만든다.

   ```bash
   cd /Users/gonasooc-mini/Desktop/gonasoo.dev/repositories/k-football-radar
   deploy/macos/build-release.sh
   ```

3. 빌드가 출력한 full Git SHA를 명시적으로 선택하고 앱만 교체한다.

   ```bash
   deploy/macos/select-release.sh FULL_GIT_SHA
   deploy/macos/deploy-release.sh
   ```

4. 공개 health endpoint를 확인한다.

   ```bash
   curl --fail --silent --show-error https://k-football-radar.app/api/health
   ```

이미지는 `k-football-radar:git-FULL_GIT_SHA` 형식이며 `latest`나
`docker compose up --build`로 운영 배포하지 않는다. 이전 검증 릴리스의 SHA를 다시
선택하고 서비스를 재생성하면 코드 롤백이 가능하다.

## 도메인과 ingress

1. Porkbun에서 최종 도메인을 구매한다. 구매 후 registrar lock과 자동 갱신을 켠다.
2. DNS 권한을 Cloudflare로 위임한다. Porkbun에는 Cloudflare가 지정한 두 nameserver만
   등록한다.
3. Cloudflare Dashboard에서 기존 공유 Tunnel에 public hostname을 추가한다. hostname은
   apex (`k-football-radar.app`)이고
   service는 `http://k-football-radar:3000`이다. Tunnel token, Porkbun API key,
   Cloudflare API token은 Git이나 채팅에 기록하지 않는다.
4. `deploy/macos/deploy-release.sh`를 실행한다.
5. Cloudflare가 인증서를 발급한 뒤 `https://k-football-radar.app/api/health`와 주요 페이지를
   확인한다. `NEXT_PUBLIC_SITE_URL`도 같은 URL이어야 canonical/OG URL이 일치한다.

Vercel 프로젝트의 production domain은 DNS와 health 확인이 끝난 뒤에만 제거한다.
