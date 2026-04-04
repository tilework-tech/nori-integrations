#!/bin/bash
# nori-gws/setup.sh — Verify gws installation and Google Workspace auth configuration.
#
# Usage: setup.sh [--smoke-test]
#
# Exit codes:
#   0 — All checks passed
#   1 — Missing prerequisite (binary, env var, credentials file)
#   2 — Smoke test failed (API call unsuccessful)
#
# Source: nori-gws/setup.sh

set -euo pipefail

SCRIPT_SOURCE="nori-gws/setup.sh"
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

# 1. Install gws if not present
if ! command -v gws &>/dev/null; then
    echo "gws not found, installing @googleworkspace/cli..." >&2
    if command -v npm &>/dev/null; then
        npm install -g @googleworkspace/cli >&2
    else
        echo "ERROR: gws is not installed and npm is not available to install it." >&2
        echo "" >&2
        echo "Install npm first, or install gws manually:" >&2
        echo "  brew install googleworkspace-cli" >&2
        echo "  cargo install --git https://github.com/googleworkspace/cli --locked" >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 1
    fi

    if ! command -v gws &>/dev/null; then
        echo "ERROR: npm install succeeded but gws is still not on PATH." >&2
        echo "" >&2
        echo "Check that npm global bin directory is in your PATH:" >&2
        echo "  npm config get prefix" >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 1
    fi
    echo "gws installed successfully." >&2
fi

GWS_VERSION=$(gws --version 2>/dev/null || echo "unknown")

# 2. Check required env vars
if [[ -z "${GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE:-}" ]]; then
    echo "ERROR: GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE is not set." >&2
    echo "" >&2
    echo "Set it to the path of your Google service account JSON key file:" >&2
    echo "  export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/service-account.json" >&2
    echo "" >&2
    echo "To create a service account key:" >&2
    echo "  1. Go to GCP Console > IAM > Service Accounts" >&2
    echo "  2. Create or select a service account" >&2
    echo "  3. Keys > Add Key > Create new key > JSON" >&2
    echo "Source: $SCRIPT_SOURCE" >&2
    exit 1
fi

if [[ -z "${GOOGLE_WORKSPACE_CLI_IMPERSONATED_USER:-}" ]]; then
    echo "ERROR: GOOGLE_WORKSPACE_CLI_IMPERSONATED_USER is not set." >&2
    echo "" >&2
    echo "Set it to the email of the user to impersonate via domain-wide delegation:" >&2
    echo "  export GOOGLE_WORKSPACE_CLI_IMPERSONATED_USER=admin@yourdomain.com" >&2
    echo "" >&2
    echo "Prerequisites:" >&2
    echo "  1. Enable domain-wide delegation on the service account (GCP Console)" >&2
    echo "  2. Authorize scopes in Workspace Admin Console > Security > API Controls" >&2
    echo "Source: $SCRIPT_SOURCE" >&2
    exit 1
fi

# 3. Validate credentials file exists
if [[ ! -f "$GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE" ]]; then
    echo "ERROR: Credentials file not found at: $GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE" >&2
    echo "" >&2
    echo "The file specified by GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE does not exist." >&2
    echo "Source: $SCRIPT_SOURCE" >&2
    exit 1
fi

# 4. Validate credentials file is JSON
if command -v jq &>/dev/null; then
    if ! jq empty "$GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE" 2>/dev/null; then
        echo "ERROR: Credentials file is not valid JSON: $GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE" >&2
        echo "" >&2
        echo "The file must be a valid JSON file (service account key or exported OAuth credentials)." >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 1
    fi

    # 5. Check credential type
    CRED_TYPE=$(jq -r '.type // empty' "$GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE" 2>/dev/null || true)
    if [[ "$CRED_TYPE" != "service_account" ]]; then
        echo "Warning: Credentials file type is '${CRED_TYPE:-unknown}', not 'service_account'." >&2
        echo "Domain-wide delegation requires a service_account credential type." >&2
        echo "This may still work if using exported OAuth credentials." >&2
    fi
else
    # No jq — do a basic check
    if ! head -c 1 "$GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE" | grep -q '{'; then
        echo "ERROR: Credentials file does not appear to be JSON: $GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE" >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 1
    fi
fi

# 6. Smoke test (optional)
if [[ "$SMOKE_TEST" == true ]]; then
    echo "Running smoke test..." >&2
    SMOKE_OUTPUT=$(gws drive about get --format json 2>&1) && SMOKE_OK=true || SMOKE_OK=false
    if [[ "$SMOKE_OK" == true ]]; then
        echo "Smoke test passed." >&2
    else
        echo "ERROR: Smoke test failed — gws API call was unsuccessful." >&2
        echo "" >&2
        echo "gws output:" >&2
        echo "$SMOKE_OUTPUT" >&2
        echo "" >&2
        echo "Possible causes:" >&2
        echo "  - Service account does not have domain-wide delegation enabled" >&2
        echo "  - Required scopes not authorized in Workspace Admin Console" >&2
        echo "  - Drive API not enabled in GCP project" >&2
        echo "  - Impersonated user does not exist" >&2
        echo "" >&2
        echo "Debug with: gws drive about get --format json" >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 2
    fi
fi

# 7. Report status
echo "Google Workspace CLI is ready." >&2
echo "  gws version: $GWS_VERSION" >&2
echo "  credentials: $GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE" >&2
echo "  impersonating: $GOOGLE_WORKSPACE_CLI_IMPERSONATED_USER" >&2
