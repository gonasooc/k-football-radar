#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
config_file="$root_dir/deploy/macos/production.env"
state_dir="${K_FOOTBALL_RADAR_STATE_DIR:-$HOME/server/state/k-football-radar}"
selected="$state_dir/selected-release.env"

fail() { printf 'error: %s\n' "$1" >&2; exit 1; }
[[ -f "$config_file" && ! -L "$config_file" ]] || fail "create private deploy/macos/production.env first"
[[ "$(stat -f '%Lp' "$config_file")" == "600" ]] || fail "production.env mode must be 600"
[[ -f "$selected" && ! -L "$selected" ]] || fail "select a release first"
[[ "$(stat -f '%Lp' "$selected")" == "600" ]] || fail "selected release mode must be 600"
network="$(sed -n 's/^K_FOOTBALL_RADAR_INGRESS_NETWORK=//p' "$config_file")"
docker network inspect "$network" >/dev/null 2>&1 || fail "missing ingress network: $network"

env -i HOME="$HOME" PATH="$PATH" docker compose \
  --env-file "$config_file" --env-file "$selected" \
  -f "$root_dir/deploy/macos/compose.yaml" \
  up -d --no-build --force-recreate --wait --wait-timeout 120
