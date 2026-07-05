#!/usr/bin/env bash
# Merge các file config nhỏ (global, consumers, services/*) thành 1 file
# kong.generated.yaml mà Kong DB-less load được.
#
# Dùng decK qua Docker (không cần cài local). Chạy từ thư mục gateway/kong:
#   ./build.sh
set -euo pipefail

cd "$(dirname "$0")"

DECK_IMAGE="${DECK_IMAGE:-kong/deck:latest}"
OUT="kong.generated.yaml"

# Gom tất cả file nguồn: global + consumers + mỗi service 1 file.
mapfile -t FILES < <(printf '%s\n' global.yaml consumers.yaml services/*.yaml)

echo "Merging ${#FILES[@]} file(s) -> $OUT"

# Trên Git Bash (Windows) cần Windows-style path cho -v và tắt path conversion
# cho -w, nếu không /work bị biến thành C:/Program Files/Git/work.
if command -v cygpath >/dev/null 2>&1; then
  HOST_DIR="$(cygpath -w "$PWD")"
else
  HOST_DIR="$PWD"
fi

# decK file merge gộp nhiều state file thành 1. Mount thư mục hiện tại vào container.
MSYS_NO_PATHCONV=1 docker run --rm -v "$HOST_DIR:/work" -w /work "$DECK_IMAGE" \
  file merge "${FILES[@]}" -o "$OUT"
  