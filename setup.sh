#!/bin/bash
# setup.sh — Set up all nori-integrations CLI tools and generate ~/AGENTS.md.
#
# Usage: setup.sh
#
# Exit codes:
#   0 — All sub-package setups succeeded, ~/AGENTS.md written
#   1 — One or more sub-package setups failed; ~/AGENTS.md lists only successful CLIs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILURES=0

echo "Setting up nori-integrations CLI tools..." >&2

# Toolshed bin/ directory — executables here are on $PATH when used as a toolshed
mkdir -p "$SCRIPT_DIR/bin"

# 1. nori-slack-cli: install dependencies, build, and symlink into bin/
echo "Setting up nori-slack-cli..." >&2
rm -f "$SCRIPT_DIR/bin/nori-slack"
if (cd "$SCRIPT_DIR/nori-slack-cli" && npm install && npm run build) >&2; then
    ln -sf ../nori-slack-cli/dist/index.js "$SCRIPT_DIR/bin/nori-slack"
    SLACK_OK=true
else
    SLACK_OK=false
    FAILURES=$((FAILURES + 1))
    echo "nori-slack-cli setup failed." >&2
fi

# 2. nori-broker-cli: install dependencies, build, and symlink into bin/
echo "Setting up nori-broker-cli..." >&2
rm -f "$SCRIPT_DIR/bin/nori-broker"
if (cd "$SCRIPT_DIR/nori-broker-cli" && npm install && npm run build) >&2; then
    ln -sf ../nori-broker-cli/dist/index.js "$SCRIPT_DIR/bin/nori-broker"
    BROKER_OK=true
else
    BROKER_OK=false
    FAILURES=$((FAILURES + 1))
    echo "nori-broker-cli setup failed." >&2
fi

# 3. nori-gws: run setup script to verify/install gws (renumbered)
echo "Setting up nori-gws..." >&2
if bash "$SCRIPT_DIR/nori-gws/setup.sh" >&2; then
    GWS_OK=true
else
    GWS_OK=false
    FAILURES=$((FAILURES + 1))
    echo "nori-gws setup failed." >&2
fi

# 3. nori-sprites: run setup script to verify/install sprite
echo "Setting up nori-sprites..." >&2
if bash "$SCRIPT_DIR/nori-sprites/setup.sh" >&2; then
    SPRITES_OK=true
else
    SPRITES_OK=false
    FAILURES=$((FAILURES + 1))
    echo "nori-sprites setup failed." >&2
fi

# 4. nori-gam: run setup script to verify/install gam
echo "Setting up nori-gam..." >&2
if bash "$SCRIPT_DIR/nori-gam/setup.sh" >&2; then
    GAM_OK=true
else
    GAM_OK=false
    FAILURES=$((FAILURES + 1))
    echo "nori-gam setup failed." >&2
fi

# 5. Generate ~/AGENTS.md (only list successful CLIs)
{
    echo "# Agent CLIs"
    echo "Source: $SCRIPT_DIR"
    echo ""
    [[ "$SLACK_OK" == true ]] && echo "- nori-slack: Slack Web API CLI (nori-slack-cli/)"
    [[ "$BROKER_OK" == true ]] && echo "- nori-broker: Nori Broker API CLI (nori-broker-cli/)"
    [[ "$GWS_OK" == true ]] && echo "- gws: Google Workspace CLI (nori-gws/)"
    [[ "$SPRITES_OK" == true ]] && echo "- sprite: Sprite inter-agent CLI (nori-sprites/)"
    [[ "$GAM_OK" == true ]] && echo "- gam: Google Admin CLI (nori-gam/)"
    echo ""
    echo "For detailed usage, see the nori-integrations-toolshed skill."
} > "$HOME/AGENTS.md"

# 6. Summary
echo "" >&2
echo "Setup summary:" >&2
[[ "$SLACK_OK" == true ]] && echo "  nori-slack-cli:   OK" >&2 || echo "  nori-slack-cli:   FAIL" >&2
[[ "$BROKER_OK" == true ]] && echo "  nori-broker-cli:  OK" >&2 || echo "  nori-broker-cli:  FAIL" >&2
[[ "$GWS_OK" == true ]] && echo "  nori-gws:         OK" >&2 || echo "  nori-gws:         FAIL" >&2
[[ "$SPRITES_OK" == true ]] && echo "  nori-sprites:   OK" >&2 || echo "  nori-sprites:   FAIL" >&2
[[ "$GAM_OK" == true ]] && echo "  nori-gam:       OK" >&2 || echo "  nori-gam:       FAIL" >&2

if [[ "$FAILURES" -gt 0 ]]; then
    echo "" >&2
    echo "$FAILURES package(s) failed. ~/AGENTS.md lists only successful CLIs." >&2
    exit 1
fi

echo "" >&2
echo "All CLI tools set up. ~/AGENTS.md written." >&2
echo "Add bin/ to PATH: export PATH=\"$SCRIPT_DIR/bin:\$PATH\"" >&2
