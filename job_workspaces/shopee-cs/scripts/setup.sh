#!/usr/bin/env bash
# =============================================================
# Shopee CS Bot — Setup Script
# Installs Python dependencies and validates environment config
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/config/.env"
ENV_EXAMPLE="$PROJECT_DIR/config/.env.example"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }

echo ""
echo "======================================"
echo "  Shopee CS Bot — Setup"
echo "======================================"
echo ""

# --- 1. Check Python version ---
info "Checking Python version..."
if ! command -v python3 &>/dev/null; then
    error "python3 not found. Please install Python 3.8+"
    exit 1
fi

PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PYTHON_MAJOR=$(python3 -c "import sys; print(sys.version_info.major)")
PYTHON_MINOR=$(python3 -c "import sys; print(sys.version_info.minor)")

if [[ "$PYTHON_MAJOR" -lt 3 ]] || { [[ "$PYTHON_MAJOR" -eq 3 ]] && [[ "$PYTHON_MINOR" -lt 8 ]]; }; then
    error "Python 3.8+ required. Found: $PYTHON_VERSION"
    exit 1
fi
success "Python $PYTHON_VERSION"

# --- 2. Check pip ---
info "Checking pip..."
if ! python3 -m pip --version &>/dev/null; then
    error "pip not found. Install with: python3 -m ensurepip"
    exit 1
fi
success "pip available"

# --- 3. Install dependencies ---
# Try venv first; fall back to --user install on externally-managed systems
info "Installing Python packages..."

VENV_DIR="$PROJECT_DIR/.venv"
PYTHON="python3"

if python3 -m venv "$VENV_DIR" 2>/dev/null; then
    success "Virtual environment created at .venv"
    PIP="$VENV_DIR/bin/pip"
    PYTHON="$VENV_DIR/bin/python"
    "$PIP" install --quiet --upgrade \
        "requests>=2.31.0" \
        "python-dotenv>=1.0.0" \
        "schedule>=1.2.0" \
        "colorlog>=6.7.0"
    success "All packages installed into .venv"
else
    warn "venv not available — installing to user site-packages (--user)"
    python3 -m pip install --quiet --user --break-system-packages \
        "requests>=2.31.0" \
        "python-dotenv>=1.0.0" \
        "schedule>=1.2.0" \
        "colorlog>=6.7.0" || \
    python3 -m pip install --quiet --user \
        "requests>=2.31.0" \
        "python-dotenv>=1.0.0" \
        "schedule>=1.2.0" \
        "colorlog>=6.7.0"
    success "All packages installed to user site-packages"
fi

# Verify installs
for pkg in requests dotenv schedule colorlog; do
    if "$PYTHON" -c "import $pkg" 2>/dev/null; then
        success "  import $pkg — OK"
    else
        error "  import $pkg — FAILED"
        exit 1
    fi
done

# --- 4. Create .env from example if missing ---
if [[ ! -f "$ENV_FILE" ]]; then
    warn ".env not found — copying from .env.example"
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    warn "Please edit $ENV_FILE with your Shopee credentials before running the bot!"
else
    success ".env file found"
fi

# --- 5. Validate required env vars (non-empty check) ---
info "Validating environment variables..."

# Load .env
set -a
source "$ENV_FILE" 2>/dev/null || true
set +a

REQUIRED_VARS=(
    "SHOPEE_PARTNER_ID"
    "SHOPEE_PARTNER_KEY"
    "SHOPEE_SHOP_ID"
    "SHOPEE_ACCESS_TOKEN"
    "SHOPEE_REFRESH_TOKEN"
)

ALL_SET=true
for var in "${REQUIRED_VARS[@]}"; do
    value="${!var:-}"
    if [[ -z "$value" ]] || [[ "$value" == *"your_"* ]]; then
        warn "  $var — NOT SET (placeholder value)"
        ALL_SET=false
    else
        success "  $var — set"
    fi
done

if [[ "$ALL_SET" == false ]]; then
    warn ""
    warn "Some credentials are not configured."
    warn "Edit $ENV_FILE then re-run this script or run the bot with --dry-run first."
else
    success "All credentials configured!"
fi

# --- 6. Create logs directory ---
mkdir -p "$PROJECT_DIR/logs"
touch "$PROJECT_DIR/logs/.gitkeep"
success "logs/ directory ready"

# --- 7. Make scripts executable ---
chmod +x "$SCRIPT_DIR/main.py"
chmod +x "$SCRIPT_DIR/setup.sh"
success "scripts/main.py marked executable"

# --- 8. Create a convenience run wrapper ---
WRAPPER="$PROJECT_DIR/run.sh"
if [[ -d "$VENV_DIR" ]]; then
    cat > "$WRAPPER" <<WRAPPER_EOF
#!/usr/bin/env bash
# Convenience wrapper — activates .venv and runs main.py
DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
source "\$DIR/.venv/bin/activate"
python "\$DIR/scripts/main.py" "\$@"
WRAPPER_EOF
else
    cat > "$WRAPPER" <<WRAPPER_EOF
#!/usr/bin/env bash
# Convenience wrapper — runs main.py with system python3
DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
python3 "\$DIR/scripts/main.py" "\$@"
WRAPPER_EOF
fi
chmod +x "$WRAPPER"
success "run.sh wrapper created"

echo ""
echo "======================================"
echo "  Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Edit config/.env with your Shopee credentials"
echo "  2. Test: bash run.sh --dry-run"
echo "  3. Run:  bash run.sh"
echo ""
