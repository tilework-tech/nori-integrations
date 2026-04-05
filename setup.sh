#!/bin/bash
# setup.sh — Set up all nori-integrations CLI tools and generate ~/AGENTS.md.
#
# Usage: setup.sh
#
# Exit codes:
#   0 — All sub-package setups succeeded, ~/AGENTS.md written
#   Non-zero — A sub-package setup failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Setting up nori-integrations CLI tools..." >&2

# 1. nori-slack-cli: install dependencies and build (postbuild runs npm link)
echo "Setting up nori-slack-cli..." >&2
(cd "$SCRIPT_DIR/nori-slack-cli" && npm install && npm run build) >&2

# 2. nori-gws: run setup script to verify/install gws
echo "Setting up nori-gws..." >&2
bash "$SCRIPT_DIR/nori-gws/setup.sh" >&2

# 3. nori-sprites: run setup script to verify/install sprite
echo "Setting up nori-sprites..." >&2
bash "$SCRIPT_DIR/nori-sprites/setup.sh" >&2

# 4. Generate ~/AGENTS.md
cat > "$HOME/AGENTS.md" <<EOF
# Agent CLIs
Source: $SCRIPT_DIR
- nori-slack: Slack Web API CLI (nori-slack-cli/)
- gws: Google Workspace CLI (nori-gws/)
- sprite: Sprite inter-agent CLI (nori-sprites/)
EOF

echo "All CLI tools set up. ~/AGENTS.md written." >&2
