#!/bin/bash
set -e

echo "=== teach-eng setup ==="

pip install "python-telegram-bot>=20.0" --quiet --break-system-packages 2>/dev/null \
  || pip install "python-telegram-bot>=20.0" --quiet --user

mkdir -p "$(dirname "$0")/../data"
mkdir -p "$(dirname "$0")/../logs"

echo "✓ setup complete"
