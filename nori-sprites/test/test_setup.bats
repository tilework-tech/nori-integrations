#!/usr/bin/env bats

# Tests for setup.sh — verifies sprite CLI installation, auth, and sprite reachability.

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
SETUP="$SCRIPT_DIR/setup.sh"

setup() {
    export TEST_TMPDIR
    TEST_TMPDIR="$(mktemp -d)"

    # Use a controlled HOME so ~/.sprites/sprites.json is predictable
    export HOME="$TEST_TMPDIR"

    # Create a fake sprite binary that succeeds for common subcommands
    mkdir -p "$TEST_TMPDIR/bin"
    cat > "$TEST_TMPDIR/bin/sprite" <<'STUB'
#!/bin/bash
case "$1" in
    --version|version)
        echo "sprite version v0.0.1-rc39"
        exit 0
        ;;
    list|ls)
        echo "sprite-alpha"
        echo "sprite-beta"
        echo "sprite-gamma"
        exit 0
        ;;
    auth)
        exit 0
        ;;
    *)
        echo '{"ok":true}'
        exit 0
        ;;
esac
STUB
    chmod +x "$TEST_TMPDIR/bin/sprite"

    # Create a fake sprites config (marks CLI as authenticated)
    mkdir -p "$TEST_TMPDIR/.sprites"
    echo '{"version":"1","current_user":"test"}' > "$TEST_TMPDIR/.sprites/sprites.json"

    # Set up valid env by default — tests unset as needed
    export PATH="$TEST_TMPDIR/bin:$PATH"
}

teardown() {
    rm -rf "$TEST_TMPDIR"
}

# ── Auto-install ──────────────────────────────────────────────────

@test "auto-installs sprite CLI when not on PATH" {
    rm "$TEST_TMPDIR/bin/sprite"
    cat > "$TEST_TMPDIR/bin/curl" <<STUB
#!/bin/bash
# Simulate the install script by outputting a script that creates the binary
cat <<'SCRIPT'
#!/bin/bash
mkdir -p "\$HOME/.local/bin"
cat > "\$HOME/.local/bin/sprite" <<'BIN'
#!/bin/bash
case "\\\$1" in
    --version|version) echo "sprite version v0.0.1-rc39"; exit 0 ;;
    list|ls) echo "sprite-alpha"; exit 0 ;;
    auth) exit 0 ;;
    *) echo '{"ok":true}'; exit 0 ;;
esac
BIN
chmod +x "\$HOME/.local/bin/sprite"
SCRIPT
STUB
    chmod +x "$TEST_TMPDIR/bin/curl"

    export PATH="$TEST_TMPDIR/bin:$HOME/.local/bin:/usr/bin:/bin"
    run "$SETUP"
    [ "$status" -eq 0 ]
    [[ "$output" == *"install"* ]] || [[ "$output" == *"Install"* ]]
}

@test "exits 1 when sprite CLI is missing and curl is unavailable" {
    rm "$TEST_TMPDIR/bin/sprite"
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
    [[ "$output" == *"sprite"* ]]
}

# ── Authentication ────────────────────────────────────────────────

@test "exits 0 when SPRITE_TOKEN is set and no prior config exists" {
    # Remove existing config so auth must come from SPRITE_TOKEN
    rm -rf "$TEST_TMPDIR/.sprites"

    export SPRITE_TOKEN="myorg/token-id/secret"
    run "$SETUP"
    [ "$status" -eq 0 ]
}

@test "exits 1 when SPRITE_TOKEN is not set and no config exists" {
    # Remove existing config
    rm -rf "$TEST_TMPDIR/.sprites"

    unset SPRITE_TOKEN
    run "$SETUP"
    [ "$status" -eq 1 ]
    [[ "$output" == *"SPRITE_TOKEN"* ]]
}

# ── Success path ──────────────────────────────────────────────────

@test "exits 0 when all prerequisites are met" {
    run "$SETUP"
    [ "$status" -eq 0 ]
    [[ "$output" == *"ready"* ]] || [[ "$output" == *"Ready"* ]]
}

# ── Smoke test ────────────────────────────────────────────────────

@test "smoke test exits 0 when sprite list succeeds" {
    run "$SETUP" --smoke-test
    [ "$status" -eq 0 ]
}

@test "smoke test exits 2 when sprite list fails" {
    cat > "$TEST_TMPDIR/bin/sprite" <<'STUB'
#!/bin/bash
case "$1" in
    --version|version)
        echo "sprite version v0.0.1-rc39"
        exit 0
        ;;
    auth)
        exit 0
        ;;
    list|ls)
        echo "error: connection failed" >&2
        exit 1
        ;;
esac
STUB
    chmod +x "$TEST_TMPDIR/bin/sprite"

    run "$SETUP" --smoke-test
    [ "$status" -eq 2 ]
}

# ── Specific sprite verification ──────────────────────────────────

@test "verifies specific sprites are reachable via --sprites flag" {
    run "$SETUP" --sprites sprite-alpha,sprite-beta
    [ "$status" -eq 0 ]
    [[ "$output" == *"sprite-alpha"* ]]
    [[ "$output" == *"sprite-beta"* ]]
}

@test "exits 2 when a specific sprite is not found in sprite list" {
    run "$SETUP" --sprites sprite-alpha,sprite-missing
    [ "$status" -eq 2 ]
    [[ "$output" == *"sprite-missing"* ]]
}
