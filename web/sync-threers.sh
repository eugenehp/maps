#!/usr/bin/env bash
# Build threers (mini variant) for the browser, WebGPU-only and WebGPU+WebGL2,
# and copy the shim + wasm into ./threers (WebGPU) and ./threers-gl (with the
# WebGL2 fallback). The app picks ./threers-gl with ?gl=1, or automatically
# when navigator.gpu is missing.
#
#   THREERS=/path/to/threers ./sync-threers.sh        # default: the shader-persist worktree
#   SKIP_BUILD=1 ./sync-threers.sh                    # only copy what is already in pkg-out/
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
THREERS="${THREERS:-/Users/Shared/threers-wt/shader-persist}"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$THREERS/target-sfweb}"
OUT="$HERE/.threers-build"
mkdir -p "$OUT"

if [ "${SKIP_BUILD:-}" != "1" ]; then
  for v in webgpu webgl; do
    echo "==> building threers mini ($v)"
    if [ "$v" = webgl ]; then (cd "$THREERS" && WEBGL=1 VARIANT=mini ./web/build.sh); \
    else (cd "$THREERS" && VARIANT=mini ./web/build.sh); fi
    rm -rf "$OUT/$v" && mkdir -p "$OUT/$v" && cp -R "$THREERS/web/pkg/." "$OUT/$v/"
  done
fi

for v in webgpu webgl; do
  dst="$HERE/threers"; [ "$v" = webgl ] && dst="$HERE/threers-gl"
  rm -rf "$dst" && mkdir -p "$dst/deps" "$dst/pkg"
  cp "$THREERS/web/threejs-shim.js" "$THREERS/web/video-export.js" "$dst/"
  [ -f "$THREERS/web/features.js" ] && cp "$THREERS/web/features.js" "$dst/"
  cp "$THREERS/web/deps/"*.js "$dst/deps/"
  cp -R "$OUT/$v/." "$dst/pkg/"
  echo "==> $dst ($(du -sh "$dst/pkg/threers_bg.wasm" | cut -f1) wasm)"
done
