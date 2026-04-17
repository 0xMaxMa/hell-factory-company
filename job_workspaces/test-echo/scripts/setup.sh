#!/bin/bash
set -e

echo "[setup] Checking python3..."
if ! command -v python3 &>/dev/null; then
  echo "[setup] ERROR: python3 not found. Install it first." >&2
  exit 1
fi

echo "[setup] Creating logs directory..."
mkdir -p "$(dirname "$0")/../logs"

echo "[setup] test-echo environment ready."
