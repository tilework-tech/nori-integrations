#!/usr/bin/env bats

# Tests for setup.sh — verifies GAM7 installation and credential configuration.

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
SETUP="$SCRIPT_DIR/setup.sh"

setup() {
    export TEST_TMPDIR
    TEST_TMPDIR="$(mktemp -d)"

    # Create a fake gam binary
    mkdir -p "$TEST_TMPDIR/bin"
    cat > "$TEST_TMPDIR/bin/gam" <<'STUB'
#!/bin/bash
case "$1" in
    version)
        if [[ "$2" == "simple" ]]; then
            echo "7.06.00"
        else
            echo "GAM 7.06.00 - https://github.com/GAM-team/GAM"
        fi
        exit 0
        ;;
    info)
        if [[ "$2" == "domain" ]]; then
            echo "Google Workspace Domain: example.com"
            exit 0
        fi
        ;;
esac
echo '{"ok":true}'
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/gam"

    # Create fake GAM config directory with credential files
    export GAMCFGDIR="$TEST_TMPDIR/gam-config"
    mkdir -p "$GAMCFGDIR"
    echo '{"type":"service_account"}' > "$GAMCFGDIR/oauth2service.json"
    echo '{"token":"fake"}' > "$GAMCFGDIR/oauth2.txt"
    echo '{"installed":{"client_id":"fake"}}' > "$GAMCFGDIR/client_secrets.json"

    # Restrict PATH to avoid finding real binaries
    export PATH="$TEST_TMPDIR/bin:/usr/bin:/bin"
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

# ── Missing prerequisites ────────────────────────────────────────

@test "exits 1 when GAMCFGDIR is not set" {
    unset GAMCFGDIR
    run "$SETUP"
    [ "$status" -eq 1 ]
    [[ "$output" == *"GAMCFGDIR"* ]]
}

@test "exits 1 when oauth2service.json is missing" {
    rm "$GAMCFGDIR/oauth2service.json"
    run "$SETUP"
    [ "$status" -eq 1 ]
    [[ "$output" == *"oauth2service.json"* ]]
}

@test "exits 1 when oauth2.txt is missing" {
    rm "$GAMCFGDIR/oauth2.txt"
    run "$SETUP"
    [ "$status" -eq 1 ]
    [[ "$output" == *"oauth2.txt"* ]]
}

@test "exits 1 when client_secrets.json is missing" {
    rm "$GAMCFGDIR/client_secrets.json"
    run "$SETUP"
    [ "$status" -eq 1 ]
    [[ "$output" == *"client_secrets.json"* ]]
}

# ── Auto-install ─────────────────────────────────────────────────

@test "attempts auto-install when gam is not on PATH" {
    rm "$TEST_TMPDIR/bin/gam"

    # Provide curl that outputs installer script content
    # The setup.sh pipes curl output to bash, which should create the binary
    cat > "$TEST_TMPDIR/bin/curl" <<STUB
#!/bin/bash
# Output a script that creates a fake gam binary at the expected location
cat <<'SCRIPT'
mkdir -p "\$HOME/bin/gam7"
cat > "\$HOME/bin/gam7/gam" <<'BIN'
#!/bin/bash
case "\$1" in
    version) if [[ "\$2" == "simple" ]]; then echo "7.06.00"; else echo "GAM 7.06.00"; fi; exit 0 ;;
    info) echo "Google Workspace Domain: example.com"; exit 0 ;;
esac
exit 0
BIN
chmod +x "\$HOME/bin/gam7/gam"
SCRIPT
STUB
    chmod +x "$TEST_TMPDIR/bin/curl"

    export HOME="$TEST_TMPDIR/home"
    mkdir -p "$HOME"
    export PATH="$TEST_TMPDIR/bin:$HOME/bin/gam7:/usr/bin:/bin"

    run "$SETUP"
    [ "$status" -eq 0 ]
    [[ "$output" == *"install"* ]] || [[ "$output" == *"Install"* ]]
}

@test "exits 1 when gam is missing and curl is unavailable" {
    rm "$TEST_TMPDIR/bin/gam"
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
    [[ "$output" == *"gam"* ]]
}

# ── Smoke test ───────────────────────────────────────────────────

@test "smoke test exits 0 when gam info domain succeeds" {
    run "$SETUP" --smoke-test
    [ "$status" -eq 0 ]
}

@test "smoke test exits 2 when gam info domain fails" {
    cat > "$TEST_TMPDIR/bin/gam" <<'STUB'
#!/bin/bash
case "$1" in
    version)
        if [[ "$2" == "simple" ]]; then echo "7.06.00"; fi
        exit 0
        ;;
    info)
        echo "ERROR: unauthorized" >&2
        exit 1
        ;;
esac
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/gam"

    run "$SETUP" --smoke-test
    [ "$status" -eq 2 ]
}
