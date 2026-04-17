#!/usr/bin/env bash
# Convenience wrapper — activates .venv and runs main.py
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$DIR/.venv/bin/activate"
python "$DIR/scripts/main.py" "$@"
