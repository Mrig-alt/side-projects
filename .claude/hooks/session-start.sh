#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

TRACKER_DIR="$CLAUDE_PROJECT_DIR/whatsapp-tracker"

echo "Installing whatsapp-tracker Python dependencies..."
pip install -r "$TRACKER_DIR/requirements.txt" --quiet

# Ensure PYTHONPATH includes the tracker directory so modules resolve correctly
echo "export PYTHONPATH=\"$TRACKER_DIR:\${PYTHONPATH:-}\"" >> "$CLAUDE_ENV_FILE"

echo "Setup complete."
