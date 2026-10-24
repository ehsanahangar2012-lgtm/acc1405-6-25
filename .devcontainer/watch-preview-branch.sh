#!/usr/bin/env bash
set -euo pipefail

# Only fast-forward a clean Codespaces workspace on the dedicated migration branch.
# Never overwrite unsaved edits or merge a divergent history automatically.
repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$repo_root"
branch="feature/windows-native-dotnet"

while true; do
  sleep 20
  [[ "$(git branch --show-current 2>/dev/null || true)" == "$branch" ]] || continue
  [[ -z "$(git status --porcelain 2>/dev/null || true)" ]] || continue
  git fetch --quiet origin "$branch" || continue
  local_head="$(git rev-parse HEAD 2>/dev/null || true)"
  remote_head="$(git rev-parse FETCH_HEAD 2>/dev/null || true)"
  [[ -n "$remote_head" && "$local_head" != "$remote_head" ]] || continue
  git merge --ff-only --quiet "$remote_head" || continue
  echo "Preview workspace fast-forwarded to $remote_head at $(date -u +%FT%TZ)"
done
