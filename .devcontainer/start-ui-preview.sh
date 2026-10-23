#!/usr/bin/env bash
set -euo pipefail

PREVIEW_URL="http://127.0.0.1:4173/version.json"
if curl --silent --fail "$PREVIEW_URL" >/dev/null 2>&1; then
  exit 0
fi

nohup node .devcontainer/preview-server.mjs > /tmp/ashkghalam-ui-preview.log 2>&1 < /dev/null &
for _ in $(seq 1 30); do
  if curl --silent --fail "$PREVIEW_URL" >/dev/null 2>&1; then
    echo "Ashke Ghalam private UI preview is running at port 4173."
    exit 0
  fi
  sleep 1
done

cat /tmp/ashkghalam-ui-preview.log || true
echo "Could not start the UI preview server." >&2
exit 1
