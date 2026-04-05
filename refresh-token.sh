#!/bin/bash
# Refresh the Claude OAuth token in .env from ~/.claude/.credentials.json
set -e

TOKEN=$(cat ~/.claude/.credentials.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('claudeAiOauth', {}).get('accessToken', ''))")

if [ -z "$TOKEN" ]; then
  echo "Error: could not read token from ~/.claude/.credentials.json"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
sed -i "s/^CLAUDE_CODE_OAUTH_TOKEN=.*/CLAUDE_CODE_OAUTH_TOKEN=$TOKEN/" "$SCRIPT_DIR/.env"
systemctl --user restart nanoclaw
echo "Token refreshed and service restarted."
