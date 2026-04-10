#!/bin/bash
# nori-aws-cli/setup.sh — Verify AWS CLI installation and credential configuration.
#
# Usage: setup.sh [--smoke-test]
#
# Exit codes:
#   0 — All checks passed
#   1 — Missing prerequisite (binary, env var, credentials file)
#   2 — Smoke test failed (API call unsuccessful)
#
# Source: nori-aws-cli/setup.sh

set -euo pipefail

SCRIPT_SOURCE="nori-aws-cli/setup.sh"
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

# 1. Install AWS CLI if not present
if ! command -v aws &>/dev/null; then
    echo "aws not found, installing AWS CLI v2..." >&2
    if command -v curl &>/dev/null; then
        curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip >&2
        unzip -qo /tmp/awscliv2.zip -d /tmp >&2
        /tmp/aws/install --update >&2
        rm -rf /tmp/awscliv2.zip /tmp/aws
    else
        echo "ERROR: aws is not installed and curl is not available to install it." >&2
        echo "" >&2
        echo "Install the AWS CLI v2 manually:" >&2
        echo "  curl \"https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip\" -o awscliv2.zip" >&2
        echo "  unzip awscliv2.zip && sudo ./aws/install" >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 1
    fi

    if ! command -v aws &>/dev/null; then
        echo "ERROR: Installation completed but aws is still not on PATH." >&2
        echo "" >&2
        echo "The AWS CLI installer places binaries in /usr/local/bin by default." >&2
        echo "Ensure /usr/local/bin is in your PATH, or specify --install-dir and --bin-dir." >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 1
    fi
    echo "AWS CLI installed successfully." >&2
fi

AWS_VERSION=$(aws --version 2>/dev/null || echo "unknown")

# 2. Check credentials — env vars, ~/.aws/credentials, or AWS_PROFILE + ~/.aws/config
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

# 3. Smoke test (optional)
if [[ "$SMOKE_TEST" == true ]]; then
    echo "Running smoke test..." >&2
    SMOKE_OUTPUT=$(aws sts get-caller-identity 2>&1) && SMOKE_OK=true || SMOKE_OK=false
    if [[ "$SMOKE_OK" == true ]]; then
        echo "Smoke test passed." >&2
    else
        echo "ERROR: Smoke test failed — aws sts get-caller-identity was unsuccessful." >&2
        echo "" >&2
        echo "aws output:" >&2
        echo "$SMOKE_OUTPUT" >&2
        echo "" >&2
        echo "Possible causes:" >&2
        echo "  - Access keys are invalid or deactivated" >&2
        echo "  - Security token is expired" >&2
        echo "  - Network connectivity issues" >&2
        echo "" >&2
        echo "Debug with: aws sts get-caller-identity" >&2
        echo "Source: $SCRIPT_SOURCE" >&2
        exit 2
    fi
fi

# 4. Report status
echo "AWS CLI is ready." >&2
echo "  version: $AWS_VERSION" >&2
echo "  credentials: $CRED_SOURCE" >&2
