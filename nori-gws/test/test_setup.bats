#!/usr/bin/env bats

# Tests for setup.sh — verifies gws installation and auth configuration.

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
SETUP="$SCRIPT_DIR/setup.sh"

setup() {
    export TEST_TMPDIR
    TEST_TMPDIR="$(mktemp -d)"

    # Create a fake gws binary that succeeds for any subcommand
    mkdir -p "$TEST_TMPDIR/bin"
    cat > "$TEST_TMPDIR/bin/gws" <<'STUB'
#!/bin/bash
if [[ "$1" == "--version" ]]; then
    echo "gws 0.22.5"
    exit 0
fi
echo '{"ok":true}'
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/gws"

    # Create a valid service account JSON
    cat > "$TEST_TMPDIR/service-account.json" <<'JSON'
{
  "type": "service_account",
  "project_id": "test-project",
  "private_key_id": "abc123",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----\n",
  "client_email": "test@test-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
JSON

    # Set up valid env by default — tests unset as needed
    export PATH="$TEST_TMPDIR/bin:$PATH"
    export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE="$TEST_TMPDIR/service-account.json"
    export GOOGLE_WORKSPACE_CLI_IMPERSONATED_USER="admin@example.com"
}

teardown() {
    rm -rf "$TEST_TMPDIR"
}

# ── Missing prerequisites ──────────────────────────────────────────

@test "installs gws via npm when not on PATH" {
    # Remove gws stub but provide a fake npm that "installs" it
    rm "$TEST_TMPDIR/bin/gws"
    cat > "$TEST_TMPDIR/bin/npm" <<STUB
#!/bin/bash
if [[ "\$1" == "install" && "\$2" == "-g" && "\$3" == "@googleworkspace/cli" ]]; then
    # Simulate npm install by creating gws in the same bin dir
    cat > "$TEST_TMPDIR/bin/gws" <<'GWS'
#!/bin/bash
if [[ "\\\$1" == "--version" ]]; then echo "gws 0.22.5"; exit 0; fi
echo '{"ok":true}'
exit 0
GWS
    chmod +x "$TEST_TMPDIR/bin/gws"
    exit 0
fi
exit 1
STUB
    chmod +x "$TEST_TMPDIR/bin/npm"

    # Restrict PATH so the real gws binary is not found
    export PATH="$TEST_TMPDIR/bin:/usr/bin:/bin"

    run "$SETUP"
    [ "$status" -eq 0 ]
    [[ "$output" == *"installing"* ]] || [[ "$output" == *"installed"* ]] || [[ "$output" == *"Installing"* ]]
}

@test "exits 1 when gws is missing and npm is not available" {
    # Remove gws stub and ensure no npm on path
    rm "$TEST_TMPDIR/bin/gws"
    # Hide real npm by restricting PATH to just our bin dir (which now has no gws or npm) plus coreutils
    export PATH="$TEST_TMPDIR/bin:/usr/bin:/bin"
    if command -v npm &>/dev/null; then
        skip "npm found in /usr/bin or /bin"
    fi
    run "$SETUP"
    [ "$status" -eq 1 ]
    [[ "$output" == *"npm"* ]] || [[ "$output" == *"install"* ]]
}

@test "exits 1 when GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE is not set" {
    unset GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE
    run "$SETUP"
    [ "$status" -eq 1 ]
    [[ "$output" == *"GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE"* ]]
}

@test "exits 1 when GOOGLE_WORKSPACE_CLI_IMPERSONATED_USER is not set" {
    unset GOOGLE_WORKSPACE_CLI_IMPERSONATED_USER
    run "$SETUP"
    [ "$status" -eq 1 ]
    [[ "$output" == *"GOOGLE_WORKSPACE_CLI_IMPERSONATED_USER"* ]]
}

# ── Credentials file validation ────��───────────────────────────────

@test "exits 1 when credentials file does not exist" {
    export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE="$TEST_TMPDIR/nonexistent.json"
    run "$SETUP"
    [ "$status" -eq 1 ]
    [[ "$output" == *"not found"* ]] || [[ "$output" == *"does not exist"* ]]
}

@test "exits 1 when credentials file is not valid JSON" {
    echo "not json at all" > "$TEST_TMPDIR/bad.json"
    export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE="$TEST_TMPDIR/bad.json"
    run "$SETUP"
    [ "$status" -eq 1 ]
    [[ "$output" == *"JSON"* ]] || [[ "$output" == *"json"* ]] || [[ "$output" == *"parse"* ]]
}

@test "warns but does not fail when credentials file is not service_account type" {
    echo '{"type": "authorized_user", "client_id": "x"}' > "$TEST_TMPDIR/oauth.json"
    export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE="$TEST_TMPDIR/oauth.json"
    run "$SETUP"
    [ "$status" -eq 0 ]
    [[ "$output" == *"service_account"* ]] || [[ "$output" == *"warning"* ]] || [[ "$output" == *"Warning"* ]]
}

# ── Success path ──────���────────────────────────────────────────────

@test "exits 0 when all prerequisites are met" {
    run "$SETUP"
    [ "$status" -eq 0 ]
    [[ "$output" == *"ready"* ]] || [[ "$output" == *"Ready"* ]] || [[ "$output" == *"OK"* ]]
}

# ── Smoke test ───────��─────────────────────────────────────────────

@test "smoke test succeeds when gws API call works" {
    run "$SETUP" --smoke-test
    [ "$status" -eq 0 ]
}

@test "smoke test fails when gws API call fails" {
    # Replace gws stub with one that fails on any non-version subcommand
    cat > "$TEST_TMPDIR/bin/gws" <<'STUB'
#!/bin/bash
if [[ "$1" == "--version" ]]; then
    echo "gws 0.22.5"
    exit 0
fi
echo '{"error":"unauthorized"}' >&2
exit 1
STUB
    chmod +x "$TEST_TMPDIR/bin/gws"

    run "$SETUP" --smoke-test
    [ "$status" -eq 2 ]
}
