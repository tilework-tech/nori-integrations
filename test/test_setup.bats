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

    # Stub sprite
    cat > "$TEST_TMPDIR/bin/sprite" <<'STUB'
#!/bin/bash
if [[ "$1" == "--version" ]]; then echo "sprite 0.1.0"; exit 0; fi
if [[ "$1" == "list" ]]; then echo "test-sprite"; exit 0; fi
echo '{"ok":true}'
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/sprite"

    # Stub gam
    cat > "$TEST_TMPDIR/bin/gam" <<'STUB'
#!/bin/bash
if [[ "$1" == "version" && "$2" == "simple" ]]; then echo "7.06.00"; exit 0; fi
if [[ "$1" == "version" ]]; then echo "GAM 7.06.00"; exit 0; fi
if [[ "$1" == "info" ]]; then echo "Google Workspace Domain: example.com"; exit 0; fi
echo '{"ok":true}'
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/gam"

    # Stub nori-newsletter
    cat > "$TEST_TMPDIR/bin/nori-newsletter" <<'STUB'
#!/bin/bash
if [[ "$1" == "--version" ]]; then echo "1.0.0"; exit 0; fi
if [[ "$1" == "contacts" && "$2" == "list" ]]; then echo '[]'; exit 0; fi
echo '{"ok":true}'
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/nori-newsletter"

    # Restrict PATH so only our stubs are used (no real sprite/gam/nori-newsletter leaking in)
    export PATH="$TEST_TMPDIR/bin:/usr/bin:/bin"
    export SPRITE_TOKEN="org/token-id/secret"
    mkdir -p "$HOME/.sprites"
    echo '{}' > "$HOME/.sprites/sprites.json"
    export GAMCFGDIR="$TEST_TMPDIR/gam-config"
    mkdir -p "$GAMCFGDIR"
    echo '{"type":"service_account"}' > "$GAMCFGDIR/oauth2service.json"
    echo '{"token":"fake"}' > "$GAMCFGDIR/oauth2.txt"
    echo '{"installed":{"client_id":"fake"}}' > "$GAMCFGDIR/client_secrets.json"
    export NEWSLETTER_CONFIG_FILE="$TEST_TMPDIR/newsletter.config.json"
    cat > "$NEWSLETTER_CONFIG_FILE" <<'JSON'
{"contactListName":"test-list","topicName":"updates","fromAddress":"test@example.com","replyTo":"reply@example.com"}
JSON

    # Save all CAPABILITIES.md files so tests can safely mutate them
    for caps in "$SCRIPT_DIR"/*/CAPABILITIES.md; do
        [ -f "$caps" ] && cp "$caps" "$TEST_TMPDIR/$(basename "$(dirname "$caps")")-CAPABILITIES.md.bak"
    done
}

teardown() {
    # Restore CAPABILITIES.md files
    for bak in "$TEST_TMPDIR"/*-CAPABILITIES.md.bak; do
        [ -f "$bak" ] || continue
        local dir_name="${bak##*/}"
        dir_name="${dir_name%-CAPABILITIES.md.bak}"
        cp "$bak" "$SCRIPT_DIR/$dir_name/CAPABILITIES.md"
    done
    rm -rf "$TEST_TMPDIR"
    # Clean up artifacts created by setup.sh inside the repo
    rm -rf "$SCRIPT_DIR/bin"
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
    grep -q "sprite" "$HOME/AGENTS.md"
    grep -q "gam" "$HOME/AGENTS.md"
    grep -q "nori-newsletter" "$HOME/AGENTS.md"
}

# ── Partial failure tolerance ─────────────────────────────────────

@test "exits non-zero but writes AGENTS.md when nori-gam fails" {
    # Remove gam binary and GAMCFGDIR to trigger setup failure
    rm "$TEST_TMPDIR/bin/gam"
    unset GAMCFGDIR

    run "$SETUP"
    [ "$status" -ne 0 ]
    [ -f "$HOME/AGENTS.md" ]
    grep -q "sprite" "$HOME/AGENTS.md"
    ! grep -q "gam" "$HOME/AGENTS.md"
}

@test "exits non-zero but writes AGENTS.md when nori-sprites fails" {
    # Remove sprite binary and config to trigger auth failure
    rm "$TEST_TMPDIR/bin/sprite"
    rm -rf "$HOME/.sprites"
    unset SPRITE_TOKEN

    run "$SETUP"
    [ "$status" -ne 0 ]
    [ -f "$HOME/AGENTS.md" ]
    ! grep -q "sprite" "$HOME/AGENTS.md"
    grep -q "gam" "$HOME/AGENTS.md"
}

@test "exits non-zero but writes AGENTS.md when nori-newsletter-cli fails" {
    # Remove nori-newsletter binary to trigger setup failure (config alone won't fail)
    rm "$TEST_TMPDIR/bin/nori-newsletter"

    run "$SETUP"
    [ "$status" -ne 0 ]
    [ -f "$HOME/AGENTS.md" ]
    grep -q "sprite" "$HOME/AGENTS.md"
    grep -q "gam" "$HOME/AGENTS.md"
    ! grep -q "nori-newsletter" "$HOME/AGENTS.md"
}

@test "continues running remaining setups after one fails" {
    # Make nori-sprites fail, verify gam and newsletter still ran
    rm "$TEST_TMPDIR/bin/sprite"
    rm -rf "$HOME/.sprites"
    unset SPRITE_TOKEN

    run "$SETUP"
    [ "$status" -ne 0 ]
    [[ "$output" == *"GAM is ready"* ]]
    [[ "$output" == *"nori-newsletter-cli is ready"* ]]
}

@test "prints summary with FAIL/OK status for each package" {
    # Make nori-sprites fail
    rm "$TEST_TMPDIR/bin/sprite"
    rm -rf "$HOME/.sprites"
    unset SPRITE_TOKEN

    run "$SETUP"
    [ "$status" -ne 0 ]
    [[ "$output" == *"nori-sprites"*"FAIL"* ]]
    [[ "$output" == *"nori-gam"*"OK"* ]]
}

@test "writes AGENTS.md with just header when all packages fail" {
    # Remove sprite binary and config (breaks nori-sprites)
    rm "$TEST_TMPDIR/bin/sprite"
    rm -rf "$HOME/.sprites"
    unset SPRITE_TOKEN

    # Remove gam and config (breaks nori-gam)
    rm "$TEST_TMPDIR/bin/gam"
    unset GAMCFGDIR

    # Remove nori-newsletter binary (breaks nori-newsletter-cli)
    rm "$TEST_TMPDIR/bin/nori-newsletter"

    run "$SETUP"
    [ "$status" -ne 0 ]
    [ -f "$HOME/AGENTS.md" ]
    grep -q "# Agent CLIs" "$HOME/AGENTS.md"
    ! grep -q "sprite" "$HOME/AGENTS.md"
    ! grep -q "gam" "$HOME/AGENTS.md"
    ! grep -q "nori-newsletter" "$HOME/AGENTS.md"
}

# ── bin/ directory (toolshed) ─────────────────────────────────────

@test "setup.sh does not place nori-slack in bin/" {
    run "$SETUP"
    [ "$status" -eq 0 ]
    [ ! -e "$SCRIPT_DIR/bin/nori-slack" ]
}

@test "setup.sh does not place nori-broker in bin/" {
    run "$SETUP"
    [ "$status" -eq 0 ]
    [ ! -e "$SCRIPT_DIR/bin/nori-broker" ]
}

# ── AGENTS.md toolshed skill reference ───────────────────────────

@test "~/AGENTS.md references the toolshed skill" {
    run "$SETUP"
    [ "$status" -eq 0 ]
    grep -q "nori-integrations-toolshed" "$HOME/AGENTS.md"
}

# ── Idempotency ──────────────────────────────────────────────────

@test "overwrites existing ~/AGENTS.md on re-run" {
    echo "old content" > "$HOME/AGENTS.md"
    run "$SETUP"
    [ "$status" -eq 0 ]
    ! grep -q "old content" "$HOME/AGENTS.md"
    grep -q "nori-newsletter" "$HOME/AGENTS.md"
}

# ── CAPABILITIES.md inclusion ─────────────────────────────────────

@test "~/AGENTS.md includes capability text from CAPABILITIES.md files" {
    cat > "$SCRIPT_DIR/nori-sprites/CAPABILITIES.md" <<'EOF'
Sprite CLI. Manage Fly.io sprites.
- List available sprites
- Send messages to other sprites
EOF

    run "$SETUP"
    [ "$status" -eq 0 ]
    grep -q "List available sprites" "$HOME/AGENTS.md"
    grep -q "Send messages to other sprites" "$HOME/AGENTS.md"
}

@test "~/AGENTS.md includes capabilities for multiple tools" {
    cat > "$SCRIPT_DIR/nori-gam/CAPABILITIES.md" <<'EOF'
Google Admin CLI.
- Users: create, suspend, delete
- Groups: list and manage membership
EOF

    cat > "$SCRIPT_DIR/nori-sprites/CAPABILITIES.md" <<'EOF'
Sprite CLI.
- List and manage sprites
EOF

    run "$SETUP"
    [ "$status" -eq 0 ]
    grep -q "Users: create" "$HOME/AGENTS.md"
    grep -q "Groups: list" "$HOME/AGENTS.md"
    grep -q "List and manage sprites" "$HOME/AGENTS.md"
}

@test "~/AGENTS.md falls back to one-liner when CAPABILITIES.md is missing" {
    rm -f "$SCRIPT_DIR/nori-gam/CAPABILITIES.md"

    run "$SETUP"
    [ "$status" -eq 0 ]
    # Should still list the tool with fallback one-liner
    grep -q "gam" "$HOME/AGENTS.md"
}

@test "~/AGENTS.md capabilities are indented under tool name" {
    cat > "$SCRIPT_DIR/nori-sprites/CAPABILITIES.md" <<'EOF'
Sprite CLI.
- List sprites
EOF

    run "$SETUP"
    [ "$status" -eq 0 ]
    grep -q "^  - List sprites" "$HOME/AGENTS.md"
}

@test "~/AGENTS.md skips capabilities for failed tools even if CAPABILITIES.md exists" {
    cat > "$SCRIPT_DIR/nori-sprites/CAPABILITIES.md" <<'EOF'
Sprite CLI.
- List sprite capabilities
EOF

    # Make sprites fail
    rm "$TEST_TMPDIR/bin/sprite"
    rm -rf "$HOME/.sprites"
    unset SPRITE_TOKEN

    run "$SETUP"
    [ "$status" -ne 0 ]
    ! grep -q "List sprite capabilities" "$HOME/AGENTS.md"
}
