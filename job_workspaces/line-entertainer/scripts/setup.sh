#!/usr/bin/env bash
# =============================================================================
# LINE Group Chat Entertainer Bot — Setup Script
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo "  LINE Entertainer Bot — Setup"
echo "============================================"

# --- Python version check ---
echo ""
echo "[1/5] Checking Python version..."
PYTHON_BIN=$(command -v python3 || command -v python || echo "")
if [ -z "$PYTHON_BIN" ]; then
  echo "ERROR: Python 3.10+ is required but not found."
  exit 1
fi

PYTHON_VERSION=$("$PYTHON_BIN" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PYTHON_MAJOR=$("$PYTHON_BIN" -c "import sys; print(sys.version_info.major)")
PYTHON_MINOR=$("$PYTHON_BIN" -c "import sys; print(sys.version_info.minor)")

echo "  Found Python $PYTHON_VERSION at $PYTHON_BIN"

if [ "$PYTHON_MAJOR" -lt 3 ] || { [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]; }; then
  echo "ERROR: Python 3.10+ is required. Found $PYTHON_VERSION"
  exit 1
fi
echo "  OK: Python $PYTHON_VERSION is supported."

# --- pip check ---
echo ""
echo "[2/5] Checking pip..."
PIP_BIN=$(command -v pip3 || command -v pip || echo "")
if [ -z "$PIP_BIN" ]; then
  echo "ERROR: pip not found. Install pip first."
  exit 1
fi
echo "  Found pip at $PIP_BIN"

# --- Setup virtual environment or user install ---
echo ""
echo "[3/5] Installing Python packages..."

VENV_DIR="$PROJECT_DIR/.venv"
VENV_PYTHON=""

# Try venv first (preferred)
VENV_OK=false
if "$PYTHON_BIN" -m venv --help >/dev/null 2>&1; then
  if [ ! -d "$VENV_DIR" ]; then
    echo "  Creating virtual environment at .venv ..."
    "$PYTHON_BIN" -m venv "$VENV_DIR" 2>/dev/null || true
  fi
  # Verify venv pip exists (ensurepip may be missing on some systems)
  if [ -f "$VENV_DIR/bin/pip" ]; then
    VENV_PYTHON="$VENV_DIR/bin/python"
    VENV_OK=true
  else
    echo "  venv created but pip not found (ensurepip missing). Cleaning up..."
    rm -rf "$VENV_DIR"
  fi
fi

if [ "$VENV_OK" = "true" ]; then
  echo "  Using virtual environment: $VENV_DIR"
  INSTALL_PIP="$VENV_DIR/bin/pip"
  "$INSTALL_PIP" install --quiet --upgrade pip
  "$INSTALL_PIP" install --quiet \
    "line-bot-sdk>=3.23.0" \
    "flask>=3.0.0" \
    "python-dotenv>=1.0.0" \
    "gunicorn>=21.0.0" \
    "requests>=2.31.0"
  echo "  Installed into .venv. To activate: source .venv/bin/activate"
  PYTHON_BIN="$VENV_DIR/bin/python"
else
  # Fallback: user install with --break-system-packages if needed
  echo "  venv not available, falling back to user/system install..."
  if "$PIP_BIN" install --user --quiet \
      "line-bot-sdk>=3.23.0" \
      "flask>=3.0.0" \
      "python-dotenv>=1.0.0" \
      "gunicorn>=21.0.0" \
      "requests>=2.31.0" 2>/dev/null; then
    echo "  Installed to user site-packages."
  else
    echo "  Trying with --break-system-packages flag..."
    "$PIP_BIN" install --break-system-packages --quiet \
      "line-bot-sdk>=3.23.0" \
      "flask>=3.0.0" \
      "python-dotenv>=1.0.0" \
      "gunicorn>=21.0.0" \
      "requests>=2.31.0"
    echo "  Installed with --break-system-packages."
  fi
fi

echo "  Packages installed:"
echo "    - line-bot-sdk (LINE Messaging API SDK v3)"
echo "    - flask (webhook server)"
echo "    - python-dotenv (env file loader)"
echo "    - gunicorn (production WSGI server)"
echo "    - requests (HTTP client)"

# --- Verify imports ---
echo ""
echo "[4/5] Verifying imports..."
"$PYTHON_BIN" -c "
import linebot.v3.webhooks
import linebot.v3.messaging
import flask
import dotenv
print('  All imports OK')
"

# --- Validate .env file ---
echo ""
echo "[5/5] Checking environment configuration..."

ENV_FILE="$PROJECT_DIR/config/.env"
ENV_EXAMPLE="$PROJECT_DIR/config/.env.example"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$ENV_EXAMPLE" ]; then
    echo "  WARNING: config/.env not found."
    echo "  Copy and fill it before running the bot:"
    echo "    cp config/.env.example config/.env"
    echo "    nano config/.env"
  else
    echo "  WARNING: No .env file found. Run with --dry-run for testing."
  fi
else
  echo "  Found config/.env"
  # Check for required keys
  MISSING_KEYS=()
  for KEY in LINE_CHANNEL_SECRET LINE_CHANNEL_ACCESS_TOKEN; do
    if ! grep -q "^${KEY}=" "$ENV_FILE" 2>/dev/null; then
      MISSING_KEYS+=("$KEY")
    fi
  done

  if [ ${#MISSING_KEYS[@]} -gt 0 ]; then
    echo "  WARNING: Missing required env vars in config/.env:"
    for K in "${MISSING_KEYS[@]}"; do
      echo "    - $K"
    done
    echo "  Bot can still run with --dry-run flag."
  else
    echo "  OK: All required env vars are present in config/.env"
  fi
fi

# --- Make scripts executable ---
chmod +x "$SCRIPT_DIR/setup.sh" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/main.py" 2>/dev/null || true

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. cp config/.env.example config/.env"
echo "  2. Fill in LINE_CHANNEL_SECRET and LINE_CHANNEL_ACCESS_TOKEN"
echo "  3. .venv/bin/python3 scripts/main.py --dry-run   # test without real replies"
echo "  4. .venv/bin/python3 scripts/main.py             # production mode"
echo "  (or: source .venv/bin/activate && python3 scripts/main.py --dry-run)"
echo ""
