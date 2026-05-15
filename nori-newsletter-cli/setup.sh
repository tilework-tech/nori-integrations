#!/bin/bash
# nori-newsletter-cli/setup.sh — Verify nori-newsletter-cli installation, AWS credentials, and config.
#
# Usage: setup.sh [--smoke-test]
#
# Exit codes:
#   0 — All checks passed
#   1 — Missing prerequisite (binary, credentials, or region)
#   2 — Smoke test failed
#
# Source: nori-newsletter-cli/setup.sh

set -euo pipefail

SCRIPT_SOURCE="nori-newsletter-cli/setup.sh"
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

# 1. Install nori-newsletter if not present
if ! command -v nori-newsletter &>/dev/null; then
    echo "nori-newsletter not found, installing via npm..." >&2
    if ! command -v npm &>/dev/null; then
        echo "ERROR: nori-newsletter is not installed and npm is not available to install it." >&2
        echo "" >&2
        echo "Install manually:" >&2
        echo "  npm install -g nori-newsletter-cli" >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 1
    fi

    if ! npm install -g nori-newsletter-cli >&2; then
        echo "ERROR: npm install -g nori-newsletter-cli failed." >&2
        echo "" >&2
        echo "Check npm permissions or install manually." >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 1
    fi

    if ! command -v nori-newsletter &>/dev/null; then
        echo "ERROR: Installation completed but nori-newsletter is still not on PATH." >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 1
    fi
    echo "nori-newsletter-cli installed successfully." >&2
fi

NL_VERSION=$(nori-newsletter --version 2>/dev/null || echo "unknown")

# 2. Check AWS credentials — env vars, ~/.aws/credentials, or AWS_PROFILE + ~/.aws/config
HAS_CREDS=false

if [[ -n "${AWS_ACCESS_KEY_ID:-}" && -n "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
    HAS_CREDS=true
    CRED_SOURCE="environment variables"
elif [[ -f "$HOME/.aws/credentials" ]]; then
    HAS_CREDS=true
    CRED_SOURCE="~/.aws/credentials"
elif [[ -n "${AWS_PROFILE:-}" && -f "$HOME/.aws/config" ]]; then
    HAS_CREDS=true
    CRED_SOURCE="AWS_PROFILE=$AWS_PROFILE (~/.aws/config)"
fi

if [[ "$HAS_CREDS" == false ]]; then
    echo "ERROR: No AWS credentials configured." >&2
    echo "" >&2
    echo "nori-newsletter-cli requires AWS credentials for SES access." >&2
    echo "Provide credentials using one of these methods:" >&2
    echo "  1. Environment variables:" >&2
    echo "     export AWS_ACCESS_KEY_ID=AKIA..." >&2
    echo "     export AWS_SECRET_ACCESS_KEY=..." >&2
    echo "  2. Credentials file:" >&2
    echo "     aws configure  (writes to ~/.aws/credentials)" >&2
    echo "  3. Named profile:" >&2
    echo "     export AWS_PROFILE=profile-name" >&2
    echo "Source: $SCRIPT_SOURCE" >&2
    exit 1
fi

# 3. Check AWS_REGION (or AWS_DEFAULT_REGION)
if [[ -z "${AWS_REGION:-}" && -z "${AWS_DEFAULT_REGION:-}" ]]; then
    echo "ERROR: AWS_REGION is not set." >&2
    echo "" >&2
    echo "SES requires a region. Set it with:" >&2
    echo "  export AWS_REGION=us-east-1" >&2
    echo "Source: $SCRIPT_SOURCE" >&2
    exit 1
fi
EFFECTIVE_REGION="${AWS_REGION:-$AWS_DEFAULT_REGION}"

# 4. Check newsletter config file (warn only — not required for setup)
CONFIG_STATUS="not configured"
if [[ -z "${NEWSLETTER_CONFIG_FILE:-}" ]]; then
    echo "WARNING: NEWSLETTER_CONFIG_FILE is not set." >&2
    echo "  Set it before using the CLI: export NEWSLETTER_CONFIG_FILE=/path/to/newsletter.config.json" >&2
elif [[ ! -f "$NEWSLETTER_CONFIG_FILE" ]]; then
    echo "WARNING: Config file not found: $NEWSLETTER_CONFIG_FILE" >&2
elif ! node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$NEWSLETTER_CONFIG_FILE" 2>/dev/null; then
    echo "WARNING: Config file is not valid JSON: $NEWSLETTER_CONFIG_FILE" >&2
else
    MISSING_KEYS=$(node -e "
const cfg = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
const required = ['contactListName', 'topicName', 'fromAddress', 'replyTo'];
const missing = required.filter(k => !(k in cfg));
if (missing.length) { console.log(missing.join(', ')); process.exit(1); }
" "$NEWSLETTER_CONFIG_FILE" 2>&1) || {
        echo "WARNING: Config file is missing required keys: $MISSING_KEYS" >&2
    }
    CONFIG_STATUS="$NEWSLETTER_CONFIG_FILE"
fi

# 5. Smoke test (optional)
if [[ "$SMOKE_TEST" == true ]]; then
    echo "Running smoke test..." >&2
    SMOKE_OUTPUT=$(nori-newsletter contacts list 2>&1) && SMOKE_OK=true || SMOKE_OK=false
    if [[ "$SMOKE_OK" == true ]]; then
        echo "Smoke test passed." >&2
    else
        echo "ERROR: Smoke test failed — nori-newsletter contacts list was unsuccessful." >&2
        echo "" >&2
        echo "Output:" >&2
        echo "$SMOKE_OUTPUT" >&2
        echo "" >&2
        echo "Possible causes:" >&2
        echo "  - SES contact list has not been initialized (run: nori-newsletter init)" >&2
        echo "  - AWS credentials lack SES permissions" >&2
        echo "  - AWS_REGION does not match the SES region" >&2
        echo "" >&2
        echo "Debug with: nori-newsletter contacts list" >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 2
    fi
fi

# 6. Report status
echo "nori-newsletter-cli is ready." >&2
echo "  version: $NL_VERSION" >&2
echo "  credentials: $CRED_SOURCE" >&2
echo "  region: $EFFECTIVE_REGION" >&2
echo "  config: $CONFIG_STATUS" >&2
