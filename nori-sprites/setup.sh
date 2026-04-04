#!/bin/bash
# nori-sprites/setup.sh — Verify sprite CLI installation, auth, and sprite reachability.
#
# Usage: setup.sh [--smoke-test] [--sprites name1,name2,...]
#
# Exit codes:
#   0 — All checks passed
#   1 — Missing prerequisite (binary, auth)
#   2 — Smoke test / sprite verification failed
#
# Source: nori-sprites/setup.sh

set -euo pipefail

SCRIPT_SOURCE="nori-sprites/setup.sh"
SMOKE_TEST=false
SPRITES=""

# Parse arguments — support both --sprites=val and --sprites val
_args=("$@")
_skip_next=false
for i in "${!_args[@]}"; do
    if [[ "$_skip_next" == true ]]; then
        _skip_next=false
        continue
    fi
    arg="${_args[$i]}"
    case "$arg" in
        --smoke-test) SMOKE_TEST=true ;;
        --sprites=*) SPRITES="${arg#--sprites=}" ;;
        --sprites)
            next_i=$((i + 1))
            if [[ $next_i -lt ${#_args[@]} ]]; then
                SPRITES="${_args[$next_i]}"
                _skip_next=true
            else
                echo "ERROR: --sprites requires a value (--sprites name1,name2,...)" >&2
                echo "Source: $SCRIPT_SOURCE" >&2
                exit 1
            fi
            ;;
        *)
            echo "Unknown argument: $arg" >&2
            echo "Usage: setup.sh [--smoke-test] [--sprites name1,name2,...]" >&2
            echo "Source: $SCRIPT_SOURCE" >&2
            exit 1
            ;;
    esac
done

# 1. Install sprite CLI if not present
if ! command -v sprite &>/dev/null; then
    echo "sprite CLI not found, installing from sprites.dev..." >&2
    if command -v curl &>/dev/null; then
        curl -fsSL https://sprites.dev/install.sh | sh >&2
    else
        echo "ERROR: sprite CLI is not installed and curl is not available to install it." >&2
        echo "" >&2
        echo "Install the sprite CLI manually:" >&2
        echo "  curl -fsSL https://sprites.dev/install.sh | sh" >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 1
    fi

    # Re-check after install (it installs to ~/.local/bin)
    export PATH="$HOME/.local/bin:$PATH"
    if ! command -v sprite &>/dev/null; then
        echo "ERROR: Installation completed but sprite is still not on PATH." >&2
        echo "" >&2
        echo "Add ~/.local/bin to your PATH:" >&2
        echo "  export PATH=\"\$HOME/.local/bin:\$PATH\"" >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 1
    fi
    echo "sprite CLI installed successfully." >&2
fi

SPRITE_VERSION=$(sprite --version 2>/dev/null || sprite version 2>/dev/null || echo "unknown")

# 2. Ensure auth is configured
# Check if sprite has existing config, or configure from SPRITE_TOKEN
SPRITES_CONFIG="$HOME/.sprites/sprites.json"
HAS_AUTH=false

if [[ -f "$SPRITES_CONFIG" ]]; then
    HAS_AUTH=true
fi

if [[ -n "${SPRITE_TOKEN:-}" ]]; then
    echo "Configuring sprite CLI authentication..." >&2
    sprite auth setup --token "$SPRITE_TOKEN" >&2
    HAS_AUTH=true
    echo "sprite CLI authenticated successfully." >&2
fi

if [[ "$HAS_AUTH" != true ]]; then
    echo "ERROR: sprite CLI is not authenticated and SPRITE_TOKEN is not set." >&2
    echo "" >&2
    echo "Either log in interactively:" >&2
    echo "  sprite login" >&2
    echo "" >&2
    echo "Or set SPRITE_TOKEN for non-interactive auth:" >&2
    echo "  export SPRITE_TOKEN=\"org/token-id/secret\"" >&2
    echo "  # Then re-run this script" >&2
    echo "Source: $SCRIPT_SOURCE" >&2
    exit 1
fi

# 3. Smoke test (optional, or implied by --sprites)
if [[ "$SMOKE_TEST" == true ]] || [[ -n "$SPRITES" ]]; then
    SPRITE_LIST=$(sprite list 2>&1) && LIST_OK=true || LIST_OK=false
    if [[ "$LIST_OK" != true ]]; then
        echo "ERROR: Smoke test failed — sprite list was unsuccessful." >&2
        echo "" >&2
        echo "sprite output:" >&2
        echo "$SPRITE_LIST" >&2
        echo "" >&2
        echo "Possible causes:" >&2
        echo "  - Invalid or expired authentication token" >&2
        echo "  - Sprites API is unreachable" >&2
        echo "" >&2
        echo "Debug with: sprite list" >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 2
    fi

    # 4. Verify specific sprites if requested
    if [[ -n "$SPRITES" ]]; then
        IFS=',' read -ra SPRITE_NAMES <<< "$SPRITES"
        for sprite_name in "${SPRITE_NAMES[@]}"; do
            if ! echo "$SPRITE_LIST" | grep -q "^${sprite_name}$"; then
                echo "ERROR: Sprite not found: $sprite_name" >&2
                echo "" >&2
                echo "Available sprites:" >&2
                echo "$SPRITE_LIST" | sed 's/^/  /' >&2
                echo "" >&2
                echo "Source: $SCRIPT_SOURCE" >&2
                exit 2
            fi
            echo "  verified: $sprite_name" >&2
        done
    fi

    echo "Smoke test passed." >&2
fi

# 5. Report status
if [[ -n "${SPRITE_LIST:-}" ]]; then
    SPRITE_COUNT=$(echo "$SPRITE_LIST" | wc -l | tr -d ' ')
else
    SPRITE_COUNT=$(sprite list 2>/dev/null | wc -l || echo "0")
    SPRITE_COUNT=$(echo "$SPRITE_COUNT" | tr -d ' ')
fi
echo "Sprite CLI is ready." >&2
echo "  $SPRITE_VERSION" >&2
echo "  sprites available: $SPRITE_COUNT" >&2
