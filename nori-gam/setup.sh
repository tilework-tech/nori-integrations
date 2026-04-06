#!/bin/bash
# nori-gam/setup.sh — Verify GAM7 (GAMADV-XTD3) installation and credential configuration.
#
# Usage: setup.sh [--smoke-test]
#
# Exit codes:
#   0 — All checks passed
#   1 — Missing prerequisite (binary, env var, credentials)
#   2 — Smoke test failed (API call unsuccessful)
#
# Source: nori-gam/setup.sh

set -euo pipefail

SCRIPT_SOURCE="nori-gam/setup.sh"
SMOKE_TEST=false

for arg in "$@"; do
    case "$arg" in
        --smoke-test) SMOKE_TEST=true ;;
        *)
            echo "Unknown argument: $arg" >&2
            echo "Usage: setup.sh [--smoke-test]" >&2
            echo "Source: $SCRIPT_SOURCE" >&2
            exit 1
            ;;
    esac
done

# 1. Install GAM if not present
if ! command -v gam &>/dev/null; then
    echo "gam not found, installing GAM7 (GAMADV-XTD3)..." >&2
    if command -v curl &>/dev/null; then
        bash <(curl -fsSL https://raw.githubusercontent.com/taers232c/GAMADV-XTD3/master/src/gam-install.sh) -l >&2
    else
        echo "ERROR: gam is not installed and curl is not available to install it." >&2
        echo "" >&2
        echo "Install GAM7 manually:" >&2
        echo "  bash <(curl -s -S -L https://raw.githubusercontent.com/taers232c/GAMADV-XTD3/master/src/gam-install.sh)" >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 1
    fi

    # The installer places gam at ~/bin/gam7/gam — add to PATH
    if [[ -d "$HOME/bin/gam7" ]]; then
        export PATH="$HOME/bin/gam7:$PATH"
    fi

    if ! command -v gam &>/dev/null; then
        echo "ERROR: Installation completed but gam is still not on PATH." >&2
        echo "" >&2
        echo "Add the GAM directory to your PATH:" >&2
        echo "  export PATH=\"\$HOME/bin/gam7:\$PATH\"" >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 1
    fi
    echo "GAM installed successfully." >&2
fi

GAM_VERSION=$(gam version simple 2>/dev/null || echo "unknown")

# 2. Check GAMCFGDIR env var
if [[ -z "${GAMCFGDIR:-}" ]]; then
    echo "ERROR: GAMCFGDIR is not set." >&2
    echo "" >&2
    echo "Set it to the path of your GAM configuration directory:" >&2
    echo "  export GAMCFGDIR=/path/to/gam/config" >&2
    echo "" >&2
    echo "This directory should contain:" >&2
    echo "  - oauth2service.json (service account key)" >&2
    echo "  - oauth2.txt (OAuth credentials)" >&2
    echo "  - client_secrets.json (GCP project config)" >&2
    echo "Source: $SCRIPT_SOURCE" >&2
    exit 1
fi

# 3. Validate credential files exist
for cred_file in oauth2service.json oauth2.txt client_secrets.json; do
    if [[ ! -f "$GAMCFGDIR/$cred_file" ]]; then
        echo "ERROR: Required credential file not found: $GAMCFGDIR/$cred_file" >&2
        echo "" >&2
        echo "Run GAM setup to create this file:" >&2
        echo "  gam create project  (for client_secrets.json)" >&2
        echo "  gam oauth create    (for oauth2.txt)" >&2
        echo "  gam user admin@domain.com update serviceaccount  (for oauth2service.json)" >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 1
    fi
done

# 4. Smoke test (optional)
if [[ "$SMOKE_TEST" == true ]]; then
    echo "Running smoke test..." >&2
    SMOKE_OUTPUT=$(gam info domain 2>&1) && SMOKE_OK=true || SMOKE_OK=false
    if [[ "$SMOKE_OK" == true ]]; then
        echo "Smoke test passed." >&2
    else
        echo "ERROR: Smoke test failed — gam info domain was unsuccessful." >&2
        echo "" >&2
        echo "gam output:" >&2
        echo "$SMOKE_OUTPUT" >&2
        echo "" >&2
        echo "Possible causes:" >&2
        echo "  - Service account does not have domain-wide delegation enabled" >&2
        echo "  - Required API scopes not authorized in Workspace Admin Console" >&2
        echo "  - Admin SDK API not enabled in GCP project" >&2
        echo "  - OAuth credentials expired or revoked" >&2
        echo "" >&2
        echo "Debug with: gam info domain" >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 2
    fi
fi

# 5. Report status
echo "GAM is ready." >&2
echo "  gam version: $GAM_VERSION" >&2
echo "  config: $GAMCFGDIR" >&2
