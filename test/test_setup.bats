#!/usr/bin/env bats

# Tests for top-level setup.sh — verifies unified CLI setup and AGENTS.md generation.

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
SETUP="$SCRIPT_DIR/setup.sh"

setup() {
    export TEST_TMPDIR
    TEST_TMPDIR="$(mktemp -d)"

    # Use a fake HOME so we don't clobber real ~/AGENTS.md
    export REAL_HOME="$HOME"
    export HOME="$TEST_TMPDIR/home"
    mkdir -p "$HOME"

    # Create fake bin dir with stubs for all sub-package dependencies
    mkdir -p "$TEST_TMPDIR/bin"

    # Stub npm: records calls, simulates install/build/link
    cat > "$TEST_TMPDIR/bin/npm" <<STUB
#!/bin/bash
echo "npm \$*" >> "$TEST_TMPDIR/npm_calls.log"
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/npm"

    # Stub gws
    cat > "$TEST_TMPDIR/bin/gws" <<'STUB'
#!/bin/bash
if [[ "$1" == "--version" ]]; then echo "gws 0.22.5"; exit 0; fi
echo '{"ok":true}'
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/gws"

    # Stub sprite
    cat > "$TEST_TMPDIR/bin/sprite" <<'STUB'
#!/bin/bash
if [[ "$1" == "--version" ]]; then echo "sprite 0.1.0"; exit 0; fi
if [[ "$1" == "list" ]]; then echo "test-sprite"; exit 0; fi
echo '{"ok":true}'
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/sprite"

    # Restrict PATH so only our stubs are used (no real gws/sprite/npm leaking in)
    export PATH="$TEST_TMPDIR/bin:/usr/bin:/bin"
    export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE="$TEST_TMPDIR/creds.json"
    echo '{"type":"authorized_user","client_id":"x","client_secret":"x","refresh_token":"x"}' > "$TEST_TMPDIR/creds.json"
    export SPRITE_TOKEN="org/token-id/secret"
    mkdir -p "$HOME/.sprites"
    echo '{}' > "$HOME/.sprites/sprites.json"
}

teardown() {
    rm -rf "$TEST_TMPDIR"
}

# ── AGENTS.md generation ──────────────────────────────────────────

@test "~/AGENTS.md contains a header and source reference" {
    run "$SETUP"
    [ "$status" -eq 0 ]
    [ -f "$HOME/AGENTS.md" ]
    grep -q "^# " "$HOME/AGENTS.md"
    grep -q "Source:" "$HOME/AGENTS.md"
}

@test "~/AGENTS.md lists all three CLIs" {
    run "$SETUP"
    [ "$status" -eq 0 ]
    grep -q "nori-slack" "$HOME/AGENTS.md"
    grep -q "gws" "$HOME/AGENTS.md"
    grep -q "sprite" "$HOME/AGENTS.md"
}

# ── Partial failure tolerance ─────────────────────────────────────

@test "exits non-zero but writes AGENTS.md when nori-slack-cli fails" {
    # Replace npm stub with one that fails on build
    cat > "$TEST_TMPDIR/bin/npm" <<STUB
#!/bin/bash
echo "npm \$*" >> "$TEST_TMPDIR/npm_calls.log"
if [[ "\$1" == "run" && "\$2" == "build" ]]; then exit 1; fi
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/npm"

    run "$SETUP"
    [ "$status" -ne 0 ]
    [ -f "$HOME/AGENTS.md" ]
    ! grep -q "nori-slack" "$HOME/AGENTS.md"
    grep -q "gws" "$HOME/AGENTS.md"
    grep -q "sprite" "$HOME/AGENTS.md"
}

@test "exits non-zero but writes AGENTS.md when nori-gws fails" {
    # Remove gws to trigger setup failure (missing binary + no npm to install it)
    rm "$TEST_TMPDIR/bin/gws"
    cat > "$TEST_TMPDIR/bin/npm" <<STUB
#!/bin/bash
echo "npm \$*" >> "$TEST_TMPDIR/npm_calls.log"
if [[ "\$1" == "install" && "\$2" == "-g" ]]; then exit 1; fi
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/npm"

    run "$SETUP"
    [ "$status" -ne 0 ]
    [ -f "$HOME/AGENTS.md" ]
    grep -q "nori-slack" "$HOME/AGENTS.md"
    ! grep -q "gws" "$HOME/AGENTS.md"
    grep -q "sprite" "$HOME/AGENTS.md"
}

@test "exits non-zero but writes AGENTS.md when nori-sprites fails" {
    # Remove sprite binary and config to trigger auth failure
    rm "$TEST_TMPDIR/bin/sprite"
    rm -rf "$HOME/.sprites"
    unset SPRITE_TOKEN

    run "$SETUP"
    [ "$status" -ne 0 ]
    [ -f "$HOME/AGENTS.md" ]
    grep -q "nori-slack" "$HOME/AGENTS.md"
    grep -q "gws" "$HOME/AGENTS.md"
    ! grep -q "sprite" "$HOME/AGENTS.md"
}

@test "continues running remaining setups after one fails" {
    # Make nori-slack-cli fail, verify gws and sprites still ran
    cat > "$TEST_TMPDIR/bin/npm" <<STUB
#!/bin/bash
echo "npm \$*" >> "$TEST_TMPDIR/npm_calls.log"
if [[ "\$1" == "run" && "\$2" == "build" ]]; then exit 1; fi
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/npm"

    run "$SETUP"
    [ "$status" -ne 0 ]
    # Verify gws and sprites setup messages appear in output (they ran)
    [[ "$output" == *"Google Workspace CLI is ready"* ]]
    [[ "$output" == *"Sprite CLI is ready"* ]]
}

@test "prints summary with FAIL/OK status for each package" {
    # Make nori-gws fail
    rm "$TEST_TMPDIR/bin/gws"
    cat > "$TEST_TMPDIR/bin/npm" <<STUB
#!/bin/bash
echo "npm \$*" >> "$TEST_TMPDIR/npm_calls.log"
if [[ "\$1" == "install" && "\$2" == "-g" ]]; then exit 1; fi
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/npm"

    run "$SETUP"
    [ "$status" -ne 0 ]
    [[ "$output" == *"nori-gws"*"FAIL"* ]]
    [[ "$output" == *"nori-slack-cli"*"OK"* ]]
}

@test "writes AGENTS.md with just header when all packages fail" {
    # Make npm fail on build (breaks nori-slack-cli)
    cat > "$TEST_TMPDIR/bin/npm" <<STUB
#!/bin/bash
echo "npm \$*" >> "$TEST_TMPDIR/npm_calls.log"
if [[ "\$1" == "run" && "\$2" == "build" ]]; then exit 1; fi
if [[ "\$1" == "install" && "\$2" == "-g" ]]; then exit 1; fi
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/npm"

    # Remove gws (breaks nori-gws)
    rm "$TEST_TMPDIR/bin/gws"

    # Remove sprite binary and config (breaks nori-sprites)
    rm "$TEST_TMPDIR/bin/sprite"
    rm -rf "$HOME/.sprites"
    unset SPRITE_TOKEN

    run "$SETUP"
    [ "$status" -ne 0 ]
    [ -f "$HOME/AGENTS.md" ]
    grep -q "# Agent CLIs" "$HOME/AGENTS.md"
    ! grep -q "nori-slack" "$HOME/AGENTS.md"
    ! grep -q "gws" "$HOME/AGENTS.md"
    ! grep -q "sprite" "$HOME/AGENTS.md"
}

# ── Idempotency ──────────────────────────────────────────────────

@test "overwrites existing ~/AGENTS.md on re-run" {
    echo "old content" > "$HOME/AGENTS.md"
    run "$SETUP"
    [ "$status" -eq 0 ]
    ! grep -q "old content" "$HOME/AGENTS.md"
    grep -q "nori-slack" "$HOME/AGENTS.md"
}

