#!/usr/bin/env bash
# =============================================================================
# setup.sh — Binance Auto-Earn Bot Setup Script
# Installs dependencies and validates environment configuration
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/config/.env"
ENV_EXAMPLE="$PROJECT_DIR/config/.env.example"
VENV_DIR="$PROJECT_DIR/.venv"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Header ────────────────────────────────────────────────────────────────────
echo ""
echo "============================================="
echo "   Binance Auto-Earn Bot — Setup"
echo "============================================="
echo ""

# ── 1. Check Python version ───────────────────────────────────────────────────
log_info "Checking Python version..."
if ! command -v python3 &>/dev/null; then
    log_error "python3 not found. Please install Python 3.8 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)

if [[ "$PYTHON_MAJOR" -lt 3 ]] || [[ "$PYTHON_MAJOR" -eq 3 && "$PYTHON_MINOR" -lt 8 ]]; then
    log_error "Python 3.8+ required. Found: Python $PYTHON_VERSION"
    exit 1
fi
log_ok "Python $PYTHON_VERSION detected"

# ── 2. Check pip ──────────────────────────────────────────────────────────────
log_info "Checking pip..."
if ! python3 -m pip --version &>/dev/null; then
    log_error "pip not found. Please install pip."
    exit 1
fi
log_ok "pip available"

# ── 3. Detect install method ───────────────────────────────────────────────────
log_info "Detecting Python package install method..."

VENV_PYTHON="python3"

# Strategy 1: Try creating a venv
if python3 -m venv "$VENV_DIR" 2>/dev/null && [[ -f "$VENV_DIR/bin/pip" ]]; then
    log_ok "Virtual environment created at $VENV_DIR"
    VENV_PYTHON="$VENV_DIR/bin/python"
    PIP_INSTALL=("$VENV_DIR/bin/pip" install)
elif [[ -d "$VENV_DIR" && -f "$VENV_DIR/bin/pip" ]]; then
    log_ok "Using existing virtual environment at $VENV_DIR"
    VENV_PYTHON="$VENV_DIR/bin/python"
    PIP_INSTALL=("$VENV_DIR/bin/pip" install)
else
    # Venv not available — use --break-system-packages (safe for dev/CI environments)
    log_warn "venv unavailable. Will install with --break-system-packages."
    PIP_INSTALL=(python3 -m pip install --break-system-packages)
fi

# ── 4. Check if packages already installed; install only what's missing ────────
log_info "Checking installed packages..."

PACKAGES=(
    "python-binance"
    "python-dotenv"
    "requests"
    "tabulate"
)
IMPORT_NAMES=(
    "binance"
    "dotenv"
    "requests"
    "tabulate"
)

ALL_OK=true
for i in "${!PACKAGES[@]}"; do
    pkg="${PACKAGES[$i]}"
    import_name="${IMPORT_NAMES[$i]}"
    if "$VENV_PYTHON" -c "import $import_name" 2>/dev/null; then
        log_ok "  $pkg already installed"
    else
        log_info "  Installing $pkg..."
        if "${PIP_INSTALL[@]}" "$pkg" --quiet 2>&1; then
            log_ok "  $pkg installed"
        else
            log_error "  Failed to install $pkg"
            ALL_OK=false
        fi
    fi
done

if [[ "$ALL_OK" == "true" ]]; then
    log_ok "All dependencies ready"
else
    log_error "Some dependencies failed to install. Check output above."
    exit 1
fi

# ── 5. Verify imports ─────────────────────────────────────────────────────────
log_info "Verifying Python imports..."
"$VENV_PYTHON" -c "
import binance
import dotenv
import requests
import tabulate
print('All imports OK')
" && log_ok "Import verification passed"

# ── 6a. Copy .env.example if .env does not exist ─────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
    if [[ -f "$ENV_EXAMPLE" ]]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        log_warn ".env file created from .env.example — please fill in your API keys"
        log_warn "  Edit: $ENV_FILE"
    else
        log_warn ".env.example not found, skipping .env creation"
    fi
else
    log_ok ".env file already exists"
fi

# ── 6b. Validate environment variables (if .env exists and is filled) ─────────
log_info "Checking environment configuration..."

REQUIRED_VARS=(
    "BINANCE_API_KEY"
    "BINANCE_SECRET_KEY"
)

ENV_VALID=true
if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set +euo pipefail
    source <(grep -v '^#' "$ENV_FILE" | grep -v '^[[:space:]]*$' | sed 's/^/export /')
    set -euo pipefail

    for var in "${REQUIRED_VARS[@]}"; do
        val="${!var:-}"
        if [[ -z "$val" || "$val" == "your_"* || "$val" == "REPLACE_ME"* ]]; then
            log_warn "  $var is not set or is a placeholder"
            ENV_VALID=false
        else
            # Mask key for display
            masked="${val:0:4}****${val: -4}"
            log_ok "  $var = $masked"
        fi
    done
else
    log_warn ".env file not found at $ENV_FILE"
    ENV_VALID=false
fi

# ── 7. Ensure logs directory exists ───────────────────────────────────────────
mkdir -p "$PROJECT_DIR/logs"
log_ok "Logs directory ready: $PROJECT_DIR/logs"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "============================================="
if [[ "$ENV_VALID" == "true" ]]; then
    log_ok "Setup complete! Ready to run."
    echo ""
    echo "  Activate venv: source $VENV_DIR/bin/activate"
    echo "  Run dry-run:   $VENV_PYTHON $SCRIPT_DIR/main.py --dry-run"
    echo "  Run live:      $VENV_PYTHON $SCRIPT_DIR/main.py --asset USDT"
    echo "  List only:     $VENV_PYTHON $SCRIPT_DIR/main.py --list-only"
else
    log_warn "Setup complete, but API keys are missing."
    echo ""
    echo "  1. Edit:  $ENV_FILE"
    echo "  2. Set BINANCE_API_KEY and BINANCE_SECRET_KEY"
    echo "  3. Activate venv: source $VENV_DIR/bin/activate"
    echo "  4. Run:   $VENV_PYTHON $SCRIPT_DIR/main.py --dry-run"
fi
echo "============================================="
echo ""
