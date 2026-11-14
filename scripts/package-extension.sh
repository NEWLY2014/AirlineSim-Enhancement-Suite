#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION=$(node -e 'const manifest = require(process.argv[1]); console.log(manifest.version_name || manifest.version)' "$ROOT_DIR/extension/manifest.json")
OUT_DIR="$ROOT_DIR/dist"
OUT_FILE="$OUT_DIR/AES-v$VERSION.zip"

npm --prefix "$ROOT_DIR" run build

mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

cd "$ROOT_DIR/build/extension"
zip -r "$OUT_FILE" . \
    -x '*.DS_Store' \
    -x '.Rhistory' \
    -x '*.log'

echo "$OUT_FILE"
