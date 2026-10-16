#!/usr/bin/env bash
# Dev server for the map.   ./serve.sh [port]   (default 8123)
#   default:    the API server (../crates/api): the app, the data, /api/v1, and marks in ../marks.sqlite
#   --static:   python3 http.server only — the app falls back to static files + browser marks
set -euo pipefail
cd "$(dirname "$0")"
STATIC=0; [ "${1:-}" = "--static" ] && { STATIC=1; shift; }
PORT="${1:-${PORT:-8123}}"
[ -d threers/pkg ] || echo "warning: ./threers/pkg missing — run ./sync-threers.sh first" >&2
if [ "$STATIC" = 0 ] && command -v cargo >/dev/null; then
  (cd .. && cargo build --release -q -p api 2>/dev/null) && exec ../target/release/api --host "${HOST:-0.0.0.0}" --port "$PORT" --web . --data data
  echo "api build failed; serving static files" >&2
fi
echo "serving $(pwd) on http://localhost:$PORT/  (try ?city=sf, ?city=nyc, ?gl=1 for WebGL2)"
exec python3 - "$PORT" <<'PY'
import http.server, socketserver, sys
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.wasm': 'application/wasm', '.js': 'text/javascript', '.mjs': 'text/javascript',
                      '.json': 'application/json', '.bin': 'application/octet-stream'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, fmt, *args):
        if '404' in (fmt % args) or '500' in (fmt % args):
            sys.stderr.write(fmt % args + '\n')
class S(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True
S(('0.0.0.0', int(sys.argv[1])), H).serve_forever()
PY
