#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environment
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "=== AsiMaster SessionStart Hook ==="

# Backend: Install Python dependencies
echo "Installing backend dependencies..."
cd "$CLAUDE_PROJECT_DIR/backend"
pip install -r requirements.txt --quiet --ignore-installed cryptography

# Set PYTHONPATH for backend imports
echo "export PYTHONPATH=\"$CLAUDE_PROJECT_DIR/backend\"" >> "$CLAUDE_ENV_FILE"

# Frontend: Install Node dependencies
echo "Installing frontend dependencies..."
cd "$CLAUDE_PROJECT_DIR/frontend"
npm install

echo "=== SessionStart Hook Complete ==="
