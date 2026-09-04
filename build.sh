#!/usr/bin/env bash
# Assembles browser-specific extension packages from the shared source files.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$ROOT_DIR/dist"
SHARED_FILES=(background.js popup.html popup.js popup.css rules.json)

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/firefox" "$DIST_DIR/chrome"

for f in "${SHARED_FILES[@]}"; do
  cp "$ROOT_DIR/$f" "$DIST_DIR/firefox/$f"
  cp "$ROOT_DIR/$f" "$DIST_DIR/chrome/$f"
done

cp "$ROOT_DIR/manifest.json" "$DIST_DIR/firefox/manifest.json"
cp "$ROOT_DIR/manifest.chrome.json" "$DIST_DIR/chrome/manifest.json"

rm -f "$DIST_DIR/koeln-ratsinfo-mirror-firefox.zip" "$DIST_DIR/koeln-ratsinfo-mirror-chrome.zip"
(cd "$DIST_DIR/firefox" && zip -r -FS "../koeln-ratsinfo-mirror-firefox.zip" . >/dev/null)
(cd "$DIST_DIR/chrome" && zip -r -FS "../koeln-ratsinfo-mirror-chrome.zip" . >/dev/null)

echo "Built:"
echo "  $DIST_DIR/koeln-ratsinfo-mirror-firefox.zip"
echo "  $DIST_DIR/koeln-ratsinfo-mirror-chrome.zip"
