#!/bin/bash
set -e

echo "=== Shopee Affiliate Setup ==="

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "[FAIL] Python 3 not found"
    exit 1
fi
echo "[OK] Python $(python3 --version) found"

# Install dependencies
pip install requests python-dotenv --break-system-packages -q 2>/dev/null \
    || pip install requests python-dotenv -q 2>/dev/null \
    || true
python3 -c "import requests, dotenv" 2>/dev/null || { echo "[FAIL] Missing: requests or python-dotenv"; exit 1; }
echo "[OK] Dependencies installed"

# Check .env
ENV_FILE="$(dirname "$0")/../config/.env"
EXAMPLE_FILE="$(dirname "$0")/../config/.env.example"

if [ ! -f "$ENV_FILE" ]; then
    echo "[WARN] .env not found, copying from .env.example"
    cp "$EXAMPLE_FILE" "$ENV_FILE"
    echo "[ACTION] Edit config/.env and fill in APP_ID and SECRET_KEY"
    exit 1
fi
echo "[OK] .env file found"

# Validate required vars
source "$ENV_FILE"
if [ -z "$APP_ID" ] || [ "$APP_ID" = "your_app_id_here" ]; then
    echo "[FAIL] APP_ID not set in config/.env"
    exit 1
fi
echo "[OK] APP_ID set"

if [ -z "$SECRET_KEY" ] || [ "$SECRET_KEY" = "your_secret_key_here" ]; then
    echo "[FAIL] SECRET_KEY not set in config/.env"
    exit 1
fi
echo "[OK] SECRET_KEY set"

# Create output directory
mkdir -p "$(dirname "$0")/../output"
echo "[OK] Output directory ready"

echo "Setup complete."
