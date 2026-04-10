#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION=$(sed -n 's/.*"version": "\(.*\)",/\1/p' "$ROOT_DIR/extension/manifest.json" | head -n 1)
OUT_DIR="$ROOT_DIR/dist"
OUT_FILE="$OUT_DIR/AES-v$VERSION.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

cd "$ROOT_DIR/extension"
zip -r "$OUT_FILE" . \
    -x '*.DS_Store' \
    -x '.Rhistory' \
    -x '*.log'

echo "$OUT_FILE"
