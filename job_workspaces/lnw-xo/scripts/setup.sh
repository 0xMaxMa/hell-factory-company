#!/bin/bash
set -e

echo "=== lnw-xo setup ==="

pip install "python-telegram-bot>=20.0" "eth-account>=0.11.0" "web3>=6.0.0" --quiet --break-system-packages 2>/dev/null \
  || pip install "python-telegram-bot>=20.0" "eth-account>=0.11.0" "web3>=6.0.0" --quiet --user

mkdir -p "$(dirname "$0")/../data"
mkdir -p "$(dirname "$0")/../logs"

echo "✓ setup complete"
