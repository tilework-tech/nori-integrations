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

    # Provide env vars needed by sub-package setup scripts
    export PATH="$TEST_TMPDIR/bin:$PATH"
    export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE="$TEST_TMPDIR/creds.json"
    echo '{"type":"service_account"}' > "$TEST_TMPDIR/creds.json"
    export GOOGLE_WORKSPACE_CLI_IMPERSONATED_USER="admin@example.com"
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

# ── Failure propagation ──────────────────────────────────────────

@test "fails if nori-slack-cli build fails" {
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
    [ ! -f "$HOME/AGENTS.md" ]
}

@test "fails if nori-gws setup fails" {
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
    [ ! -f "$HOME/AGENTS.md" ]
}

@test "fails if nori-sprites setup fails" {
    # Remove sprite binary and config to trigger auth failure
    rm "$TEST_TMPDIR/bin/sprite"
    rm -rf "$HOME/.sprites"
    unset SPRITE_TOKEN

    run "$SETUP"
    [ "$status" -ne 0 ]
    [ ! -f "$HOME/AGENTS.md" ]
}

# ── Idempotency ──────────────────────────────────────────────────

@test "overwrites existing ~/AGENTS.md on re-run" {
    echo "old content" > "$HOME/AGENTS.md"
    run "$SETUP"
    [ "$status" -eq 0 ]
    ! grep -q "old content" "$HOME/AGENTS.md"
    grep -q "nori-slack" "$HOME/AGENTS.md"
}

