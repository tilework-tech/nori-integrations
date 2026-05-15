#!/usr/bin/env bats

# Tests for setup.sh — verifies nori-newsletter-cli installation, AWS credentials, and config.

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
SETUP="$SCRIPT_DIR/setup.sh"

setup() {
    export TEST_TMPDIR
    TEST_TMPDIR="$(mktemp -d)"

    # Create a fake nori-newsletter binary
    mkdir -p "$TEST_TMPDIR/bin"
    cat > "$TEST_TMPDIR/bin/nori-newsletter" <<'STUB'
#!/bin/bash
if [[ "$1" == "--version" ]]; then
    echo "1.0.0"
    exit 0
fi
if [[ "$1" == "contacts" && "$2" == "list" ]]; then
    echo '[]'
    exit 0
fi
if [[ "$1" == "--help" ]]; then
    echo "Usage: nori-newsletter <command>"
    exit 0
fi
echo '{"ok":true}'
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/nori-newsletter"

    # Stub npm for install tests
    cat > "$TEST_TMPDIR/bin/npm" <<'STUB'
#!/bin/bash
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/npm"

    # Set up valid env by default — tests unset as needed
    export PATH="$TEST_TMPDIR/bin:/usr/bin:/bin"
    export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
    export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    export AWS_REGION="us-east-1"

    # Use a fake HOME so we don't touch real config
    export REAL_HOME="$HOME"
    export HOME="$TEST_TMPDIR/home"
    mkdir -p "$HOME"

    # Create a valid newsletter config
    export NEWSLETTER_CONFIG_FILE="$TEST_TMPDIR/newsletter.config.json"
    cat > "$NEWSLETTER_CONFIG_FILE" <<'JSON'
{
  "contactListName": "my-newsletter",
  "topicName": "weekly-updates",
  "fromAddress": "newsletter@example.com",
  "replyTo": "reply@example.com"
}
JSON
}

teardown() {
    rm -rf "$TEST_TMPDIR"
}

# ── Success path ──────────────────────────────────────────────────

@test "exits 0 when all prerequisites are met" {
    run "$SETUP"
    [ "$status" -eq 0 ]
    [[ "$output" == *"ready"* ]] || [[ "$output" == *"Ready"* ]]
}

# ── Binary detection and installation ─────────────────────────────

@test "attempts npm install when nori-newsletter is not on PATH" {
    rm "$TEST_TMPDIR/bin/nori-newsletter"

    # Stub npm to "install" the binary
    cat > "$TEST_TMPDIR/bin/npm" <<STUB
#!/bin/bash
if [[ "\$1" == "install" && "\$2" == "-g" ]]; then
    cat > "$TEST_TMPDIR/bin/nori-newsletter" <<'BIN'
#!/bin/bash
if [[ "\\\$1" == "--version" ]]; then echo "1.0.0"; exit 0; fi
if [[ "\\\$1" == "contacts" && "\\\$2" == "list" ]]; then echo '[]'; exit 0; fi
exit 0
BIN
    chmod +x "$TEST_TMPDIR/bin/nori-newsletter"
    exit 0
fi
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/npm"

    run "$SETUP"
    [ "$status" -eq 0 ]
    [[ "$output" == *"install"* ]] || [[ "$output" == *"Install"* ]]
}

@test "exits 1 when nori-newsletter is missing and npm is unavailable" {
    rm "$TEST_TMPDIR/bin/nori-newsletter"
    rm "$TEST_TMPDIR/bin/npm"

    run "$SETUP"
    [ "$status" -eq 1 ]
    [[ "$output" == *"nori-newsletter"* ]]
}

@test "exits 1 when nori-newsletter is missing and npm install fails" {
    rm "$TEST_TMPDIR/bin/nori-newsletter"

    cat > "$TEST_TMPDIR/bin/npm" <<'STUB'
#!/bin/bash
exit 1
STUB
    chmod +x "$TEST_TMPDIR/bin/npm"

    run "$SETUP"
    [ "$status" -eq 1 ]
}

# ── AWS credential validation ────────────────────────────────────

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

@test "exits 1 when no AWS credentials are configured" {
    unset AWS_ACCESS_KEY_ID
    unset AWS_SECRET_ACCESS_KEY
    unset AWS_PROFILE

    run "$SETUP"
    [ "$status" -eq 1 ]
    [[ "$output" == *"credentials"* ]] || [[ "$output" == *"AWS_ACCESS_KEY_ID"* ]]
}

# ── AWS_REGION validation ────────────────────────────────────────

@test "exits 1 when AWS_REGION is not set" {
    unset AWS_REGION

    run "$SETUP"
    [ "$status" -eq 1 ]
    [[ "$output" == *"AWS_REGION"* ]]
}

# ── Newsletter config validation ─────────────────────────────────

@test "exits 0 with warning when NEWSLETTER_CONFIG_FILE is not set" {
    unset NEWSLETTER_CONFIG_FILE

    run "$SETUP"
    [ "$status" -eq 0 ]
    [[ "$output" == *"WARNING"* ]]
    [[ "$output" == *"NEWSLETTER_CONFIG_FILE"* ]]
}

@test "exits 0 with warning when NEWSLETTER_CONFIG_FILE points to nonexistent file" {
    export NEWSLETTER_CONFIG_FILE="$TEST_TMPDIR/does-not-exist.json"

    run "$SETUP"
    [ "$status" -eq 0 ]
    [[ "$output" == *"WARNING"* ]]
}

@test "exits 0 with warning when config file is invalid JSON" {
    echo "not valid json{{{" > "$NEWSLETTER_CONFIG_FILE"

    run "$SETUP"
    [ "$status" -eq 0 ]
    [[ "$output" == *"WARNING"* ]]
}

@test "exits 0 with warning when config file is missing required keys" {
    echo '{"contactListName": "test"}' > "$NEWSLETTER_CONFIG_FILE"

    run "$SETUP"
    [ "$status" -eq 0 ]
    [[ "$output" == *"WARNING"* ]]
}

# ── Smoke test ───────────────────────────────────────────────────

@test "smoke test exits 0 when nori-newsletter contacts list succeeds" {
    run "$SETUP" --smoke-test
    [ "$status" -eq 0 ]
}

@test "smoke test exits 2 when nori-newsletter contacts list fails" {
    cat > "$TEST_TMPDIR/bin/nori-newsletter" <<'STUB'
#!/bin/bash
if [[ "$1" == "--version" ]]; then
    echo "1.0.0"
    exit 0
fi
if [[ "$1" == "contacts" && "$2" == "list" ]]; then
    echo "Error: SES contact list not found" >&2
    exit 1
fi
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/nori-newsletter"

    run "$SETUP" --smoke-test
    [ "$status" -eq 2 ]
}

# ── Error messages include source attribution ────────────────────

@test "error messages include Source: line" {
    unset AWS_ACCESS_KEY_ID
    unset AWS_SECRET_ACCESS_KEY
    unset AWS_PROFILE

    run "$SETUP"
    [ "$status" -eq 1 ]
    [[ "$output" == *"Source:"* ]]
}
