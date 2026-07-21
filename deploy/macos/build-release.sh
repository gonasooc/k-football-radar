#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
config_file="$root_dir/deploy/macos/production.env"
state_dir="${K_FOOTBALL_RADAR_STATE_DIR:-$HOME/server/state/k-football-radar}"
release_dir="$state_dir/releases"

fail() { printf 'error: %s\n' "$1" >&2; exit 1; }
read_config() { sed -n "s/^${1}=//p" "$config_file"; }

command -v docker >/dev/null 2>&1 || fail "docker is required"
command -v git >/dev/null 2>&1 || fail "git is required"
[[ -f "$config_file" && ! -L "$config_file" ]] || fail "create private deploy/macos/production.env first"
[[ "$(stat -f '%Lp' "$config_file")" == "600" ]] || fail "production.env mode must be 600"

repository="$(read_config K_FOOTBALL_RADAR_REPOSITORY_PATH)"
site_url="$(read_config K_FOOTBALL_RADAR_SITE_URL)"
data_base_url="$(read_config K_FOOTBALL_RADAR_DATA_BASE_URL)"
ga_id="$(read_config K_FOOTBALL_RADAR_GA_ID)"
[[ "$repository" == "$root_dir" ]] || fail "K_FOOTBALL_RADAR_REPOSITORY_PATH must be $root_dir"
[[ "$site_url" =~ ^https://[^/]+$ && "$site_url" != *YOUR_DOMAIN* ]] || fail "set a final HTTPS K_FOOTBALL_RADAR_SITE_URL"
[[ "$data_base_url" =~ ^https://[^/]+$ && "$data_base_url" != *YOUR_DOMAIN* ]] \
  || fail "set a final HTTPS K_FOOTBALL_RADAR_DATA_BASE_URL"
[[ -z "$ga_id" || "$ga_id" =~ ^G-[A-Z0-9]+$ ]] \
  || fail "K_FOOTBALL_RADAR_GA_ID must look like G-XXXXXXXXXX or be empty"
git -C "$root_dir" diff --quiet || fail "worktree has unstaged changes"
git -C "$root_dir" diff --cached --quiet || fail "index has staged changes"
[[ -z "$(git -C "$root_dir" ls-files --others --exclude-standard)" ]] || fail "worktree has untracked files"

revision="$(git -C "$root_dir" rev-parse --verify HEAD)"
image="k-football-radar:git-$revision"
receipt="$release_dir/$revision.env"
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || fail "HEAD is not a full Git SHA"
mkdir -p "$release_dir"
chmod 700 "$state_dir" "$release_dir"
[[ ! -e "$receipt" ]] || fail "release receipt already exists; this Git SHA cannot be rebuilt"
docker image inspect "$image" >/dev/null 2>&1 && fail "release image already exists; this Git SHA cannot be rebuilt"

pnpm --version >/dev/null 2>&1 || fail "pnpm is required"
(
  cd "$root_dir"
  pnpm run lint
  pnpm run typecheck
  pnpm test
  pnpm run validate:data
  pnpm run build
)
git -C "$root_dir" diff --quiet || fail "validation changed tracked files"

context="$(mktemp -d "${TMPDIR:-/tmp}/k-football-radar-release-${revision}.XXXXXX")"
trap 'rm -rf "$context"' EXIT HUP INT TERM
git -C "$root_dir" archive --format=tar "$revision" | tar -xf - -C "$context"
docker build \
  --build-arg "NEXT_PUBLIC_SITE_URL=$site_url" \
  --build-arg "NEXT_PUBLIC_GA_ID=$ga_id" \
  --tag "$image" "$context"
image_id="$(docker image inspect --format '{{.Id}}' "$image")"
[[ "$image_id" =~ ^sha256:[a-f0-9]{64}$ ]] || fail "built image ID is invalid"

temporary="$(mktemp "$release_dir/.${revision}.env.XXXXXX")"
printf 'revision=%s\ntag=%s\nimage_id=%s\nbuilt_at_utc=%s\n' \
  "$revision" "$image" "$image_id" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$temporary"
chmod 600 "$temporary"
mv "$temporary" "$receipt"
printf 'Release built: %s\nSelect it with: deploy/macos/select-release.sh %s\n' "$image" "$revision"
