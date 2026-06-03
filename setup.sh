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

# 1. nori-sprites: run setup script to verify/install sprite
echo "Setting up nori-sprites..." >&2
if bash "$SCRIPT_DIR/nori-sprites/setup.sh" >&2; then
    SPRITES_OK=true
else
    SPRITES_OK=false
    FAILURES=$((FAILURES + 1))
    echo "nori-sprites setup failed." >&2
fi

# 2. nori-gam: run setup script to verify/install gam
echo "Setting up nori-gam..." >&2
if bash "$SCRIPT_DIR/nori-gam/setup.sh" >&2; then
    GAM_OK=true
else
    GAM_OK=false
    FAILURES=$((FAILURES + 1))
    echo "nori-gam setup failed." >&2
fi

# 3. nori-aws-cli: run setup script to verify/install aws
echo "Setting up nori-aws-cli..." >&2
if bash "$SCRIPT_DIR/nori-aws-cli/setup.sh" >&2; then
    AWS_OK=true
else
    AWS_OK=false
    FAILURES=$((FAILURES + 1))
    echo "nori-aws-cli setup failed." >&2
fi

# 4. nori-newsletter-cli: run setup script to verify/install nori-newsletter
echo "Setting up nori-newsletter-cli..." >&2
if bash "$SCRIPT_DIR/nori-newsletter-cli/setup.sh" >&2; then
    NEWSLETTER_OK=true
else
    NEWSLETTER_OK=false
    FAILURES=$((FAILURES + 1))
    echo "nori-newsletter-cli setup failed." >&2
fi

# Helper: emit a tool entry with optional CAPABILITIES.md content
emit_tool() {
    local name="$1" label="$2" dir="$3"
    local caps_file="$SCRIPT_DIR/$dir/CAPABILITIES.md"
    if [[ -f "$caps_file" ]] && [[ -s "$caps_file" ]]; then
        echo "- **$name**: $(head -1 "$caps_file")"
        tail -n +2 "$caps_file" | sed '/^$/d' | while IFS= read -r line || [[ -n "$line" ]]; do
            echo "  $line"
        done
    else
        echo "- **$name**: $label"
    fi
}

# 5. Generate ~/AGENTS.md (only list successful CLIs)
{
    echo "# Agent CLIs"
    echo "Source: $SCRIPT_DIR"
    echo ""
    [[ "$SPRITES_OK" == true ]] && emit_tool "sprite" "Sprite inter-agent CLI (nori-sprites/)" "nori-sprites"
    [[ "$GAM_OK" == true ]] && emit_tool "gam" "Google Admin CLI (nori-gam/)" "nori-gam"
    [[ "$AWS_OK" == true ]] && emit_tool "aws" "AWS CLI (nori-aws-cli/)" "nori-aws-cli"
    [[ "$NEWSLETTER_OK" == true ]] && emit_tool "nori-newsletter" "Newsletter CLI (nori-newsletter-cli/)" "nori-newsletter-cli"
    echo ""
    echo "For detailed usage, see the nori-integrations-toolshed skill."
} > "$HOME/AGENTS.md"

# 6. Summary
echo "" >&2
echo "Setup summary:" >&2
[[ "$SPRITES_OK" == true ]] && echo "  nori-sprites:         OK" >&2 || echo "  nori-sprites:         FAIL" >&2
[[ "$GAM_OK" == true ]] && echo "  nori-gam:             OK" >&2 || echo "  nori-gam:             FAIL" >&2
[[ "$AWS_OK" == true ]] && echo "  nori-aws-cli:         OK" >&2 || echo "  nori-aws-cli:         FAIL" >&2
[[ "$NEWSLETTER_OK" == true ]] && echo "  nori-newsletter-cli:  OK" >&2 || echo "  nori-newsletter-cli:  FAIL" >&2

if [[ "$FAILURES" -gt 0 ]]; then
    echo "" >&2
    echo "$FAILURES package(s) failed. ~/AGENTS.md lists only successful CLIs." >&2
    exit 1
fi

echo "" >&2
echo "All CLI tools set up. ~/AGENTS.md written." >&2
echo "Add bin/ to PATH: export PATH=\"$SCRIPT_DIR/bin:\$PATH\"" >&2
