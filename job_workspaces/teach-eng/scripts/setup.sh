#!/bin/bash
set -e

echo "=== teach-eng setup ==="

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] Python 3 not found. Please install Python 3.8+"
    exit 1
fi
PYTHON_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "[OK] Python $PYTHON_VER found"

# Install dependencies
echo "[...] Installing dependencies..."
PKGS="tabulate python-dotenv python-telegram-bot"
pip3 install --quiet --break-system-packages $PKGS 2>/dev/null || \
pip3 install --quiet --user $PKGS 2>/dev/null || true

python3 -c "import tabulate, dotenv, telegram" 2>/dev/null && echo "[OK] Dependencies installed" || {
    echo "[WARN] Could not verify packages — trying user install"
    pip3 install --user $PKGS
}

# Create logs dir
mkdir -p logs
echo "[OK] logs/ directory ready"

# Check .env
if [ ! -f config/.env ]; then
    echo "[INFO] config/.env not found — copy from config/.env.example to configure"
else
    echo "[OK] config/.env found"
fi

echo ""
echo "Setup complete!"
echo "  Lesson planner:  python3 scripts/main.py --dry-run"
echo "  Telegram bot:    python3 scripts/bot.py --dry-run"
