#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
requested_revision="${1:-}"
state_dir="${K_FOOTBALL_RADAR_STATE_DIR:-$HOME/server/state/k-football-radar}"
receipt="$state_dir/releases/$requested_revision.env"
selected="$state_dir/selected-release.env"

fail() { printf 'error: %s\n' "$1" >&2; exit 1; }
[[ "$requested_revision" =~ ^[a-f0-9]{40}$ ]] || fail "usage: deploy/macos/select-release.sh FULL_GIT_SHA"
[[ -f "$receipt" && ! -L "$receipt" ]] || fail "missing release receipt"
[[ "$(stat -f '%Lp' "$receipt")" == "600" ]] || fail "release receipt mode must be 600"

revision="$(sed -n 's/^revision=//p' "$receipt")"
tag="$(sed -n 's/^tag=//p' "$receipt")"
image_id="$(sed -n 's/^image_id=//p' "$receipt")"
[[ "$revision" == "$requested_revision" && "$tag" == "k-football-radar:git-$revision" ]] \
  || fail "invalid release receipt"
[[ "$image_id" =~ ^sha256:[a-f0-9]{64}$ ]] || fail "invalid image ID in release receipt"
[[ "$(docker image inspect --format '{{.Id}}' "$tag")" == "$image_id" ]] || fail "selected image is unavailable or changed"
temporary="$(mktemp "$state_dir/.selected-release.env.XXXXXX")"
printf 'K_FOOTBALL_RADAR_IMAGE=%s\n' "$tag" > "$temporary"
chmod 600 "$temporary"
mv "$temporary" "$selected"
printf 'Selected release: %s\n' "$revision"
