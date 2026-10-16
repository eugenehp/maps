#!/usr/bin/env bash
# Same five views into shots/<dir>/ for before/after comparisons:  tools/compare.sh after [--gl]
set -euo pipefail
cd "$(dirname "$0")"
D="${1:-after}"; shift || true
node shoot.cjs --out "shots/$D" --only overview,downtown,hills "$@" | grep -E "frame times|summary"
node shoot.cjs --out "shots/$D" --city nyc --only downtown "$@" | grep -E "frame times|summary"
node shoot.cjs --out "shots/$D" --city bay --only overview "$@" | grep -E "frame times|summary"
