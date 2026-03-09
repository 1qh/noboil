#!/usr/bin/env bash
set -euo pipefail

PIDS=()

for pkg in swift-core desktop/convex/shared desktop/convex/blog desktop/convex/chat desktop/convex/movie desktop/convex/org; do
  swift test --package-path "$pkg" &
  PIDS+=($!)
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
"$SCRIPT_DIR/build-uitests.sh" &
PIDS+=($!)

FAIL=0
for pid in "${PIDS[@]}"; do
  wait "$pid" || FAIL=1
done
exit $FAIL
