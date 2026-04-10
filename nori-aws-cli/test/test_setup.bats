#!/usr/bin/env bats

# Tests for setup.sh — verifies AWS CLI installation and credential configuration.

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
SETUP="$SCRIPT_DIR/setup.sh"

setup() {
    export TEST_TMPDIR
    TEST_TMPDIR="$(mktemp -d)"

    # Create a fake aws binary
    mkdir -p "$TEST_TMPDIR/bin"
    cat > "$TEST_TMPDIR/bin/aws" <<'STUB'
#!/bin/bash
if [[ "$1" == "--version" ]]; then
    echo "aws-cli/2.27.31 Python/3.13.3 Linux/6.12.47-fly exe/x86_64.amzn.2"
    exit 0
fi
if [[ "$1" == "sts" && "$2" == "get-caller-identity" ]]; then
    echo '{"UserId":"AIDEXAMPLE","Account":"870844658207","Arn":"arn:aws:iam::870844658207:user/nori-deploy"}'
    exit 0
fi
echo '{"ok":true}'
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/aws"

    # Set up valid env by default — tests unset as needed
    export PATH="$TEST_TMPDIR/bin:/usr/bin:/bin"
    export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
    export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

    # Use a fake HOME so we don't touch real config
    export REAL_HOME="$HOME"
    export HOME="$TEST_TMPDIR/home"
    mkdir -p "$HOME"
}

teardown() {
    rm -rf "$TEST_TMPDIR"
    rm -rf /tmp/aws /tmp/awscliv2.zip
}

# ── Success path ──────────────────────────────────────────────────

@test "exits 0 when all prerequisites are met" {
    run "$SETUP"
    [ "$status" -eq 0 ]
    [[ "$output" == *"ready"* ]] || [[ "$output" == *"Ready"* ]]
}

# ── Missing prerequisites ────────────────────────────────────────

@test "attempts auto-install when aws is not on PATH" {
    rm "$TEST_TMPDIR/bin/aws"

    # Provide a fake curl (download is a no-op, unzip is stubbed)
    cat > "$TEST_TMPDIR/bin/curl" <<'STUB'
#!/bin/bash
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/curl"

    # Provide a fake unzip that creates /tmp/aws/install which places aws on PATH
    cat > "$TEST_TMPDIR/bin/unzip" <<STUB
#!/bin/bash
mkdir -p /tmp/aws
cat > /tmp/aws/install <<INSTALLER
#!/bin/bash
cat > "$TEST_TMPDIR/bin/aws" <<'BIN'
#!/bin/bash
if [[ "\\\$1" == "--version" ]]; then echo "aws-cli/2.27.31 Python/3.13.3 Linux/6.12.47-fly exe/x86_64.amzn.2"; exit 0; fi
if [[ "\\\$1" == "sts" && "\\\$2" == "get-caller-identity" ]]; then echo '{"ok":true}'; exit 0; fi
exit 0
BIN
chmod +x "$TEST_TMPDIR/bin/aws"
INSTALLER
chmod +x /tmp/aws/install
STUB
    chmod +x "$TEST_TMPDIR/bin/unzip"

    run "$SETUP"
    [ "$status" -eq 0 ]
    [[ "$output" == *"install"* ]] || [[ "$output" == *"Install"* ]]
}

@test "exits 1 when aws is missing and curl is unavailable" {
    rm "$TEST_TMPDIR/bin/aws"
    export PATH="$TEST_TMPDIR/bin:/usr/bin:/bin"
    if command -v curl &>/dev/null; then
        cat > "$TEST_TMPDIR/bin/curl" <<'STUB'
#!/bin/bash
exit 1
STUB
        chmod +x "$TEST_TMPDIR/bin/curl"
    fi
    run "$SETUP"
    [ "$status" -eq 1 ]
    [[ "$output" == *"aws"* ]]
}

# ── Credential validation ────────────────────────────────────────

@test "exits 0 when credentials come from ~/.aws/credentials file" {
    unset AWS_ACCESS_KEY_ID
    unset AWS_SECRET_ACCESS_KEY

    mkdir -p "$HOME/.aws"
    cat > "$HOME/.aws/credentials" <<'INI'
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
INI

    run "$SETUP"
    [ "$status" -eq 0 ]
}

@test "exits 0 when AWS_PROFILE is set and ~/.aws/config has matching profile" {
    unset AWS_ACCESS_KEY_ID
    unset AWS_SECRET_ACCESS_KEY
    export AWS_PROFILE="nori-deploy"

    mkdir -p "$HOME/.aws"
    cat > "$HOME/.aws/config" <<'INI'
[profile nori-deploy]
region = us-east-1
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
INI

    run "$SETUP"
    [ "$status" -eq 0 ]
}

@test "exits 1 when no credentials are configured" {
    unset AWS_ACCESS_KEY_ID
    unset AWS_SECRET_ACCESS_KEY
    unset AWS_PROFILE

    run "$SETUP"
    [ "$status" -eq 1 ]
    [[ "$output" == *"AWS_ACCESS_KEY_ID"* ]] || [[ "$output" == *"credentials"* ]]
}

# ── Smoke test ───────────────────────────────────────────────────

@test "smoke test exits 0 when aws sts get-caller-identity succeeds" {
    run "$SETUP" --smoke-test
    [ "$status" -eq 0 ]
}

@test "smoke test exits 2 when aws sts get-caller-identity fails" {
    cat > "$TEST_TMPDIR/bin/aws" <<'STUB'
#!/bin/bash
if [[ "$1" == "--version" ]]; then
    echo "aws-cli/2.27.31 Python/3.13.3 Linux/6.12.47-fly exe/x86_64.amzn.2"
    exit 0
fi
if [[ "$1" == "sts" && "$2" == "get-caller-identity" ]]; then
    echo "An error occurred (ExpiredToken) The security token included in the request is expired" >&2
    exit 255
fi
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/aws"

    run "$SETUP" --smoke-test
    [ "$status" -eq 2 ]
}
