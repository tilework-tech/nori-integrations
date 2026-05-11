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

    # Stub npm: records calls, simulates install/build (creates dist/index.js)
    cat > "$TEST_TMPDIR/bin/npm" <<STUB
#!/bin/bash
echo "npm \$*" >> "$TEST_TMPDIR/npm_calls.log"
# Simulate build output so bin/ symlinks resolve
if [[ "\$1" == "run" && "\$2" == "build" ]]; then
    mkdir -p dist
    echo '#!/usr/bin/env node' > dist/index.js
    chmod +x dist/index.js
fi
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

    # Stub aws
    cat > "$TEST_TMPDIR/bin/aws" <<'STUB'
#!/bin/bash
if [[ "$1" == "--version" ]]; then echo "aws-cli/2.27.31 Python/3.13.3 Linux/6.12.47-fly exe/x86_64.amzn.2"; exit 0; fi
if [[ "$1" == "sts" && "$2" == "get-caller-identity" ]]; then echo '{"UserId":"AIDEXAMPLE","Account":"870844658207","Arn":"arn:aws:iam::870844658207:user/nori-deploy"}'; exit 0; fi
echo '{"ok":true}'
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/aws"

    # Restrict PATH so only our stubs are used (no real gws/sprite/npm leaking in)
    export PATH="$TEST_TMPDIR/bin:/usr/bin:/bin"
    export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE="$TEST_TMPDIR/creds.json"
    echo '{"type":"authorized_user","client_id":"x","client_secret":"x","refresh_token":"x"}' > "$TEST_TMPDIR/creds.json"
    export SPRITE_TOKEN="org/token-id/secret"
    mkdir -p "$HOME/.sprites"
    echo '{}' > "$HOME/.sprites/sprites.json"
    export GAMCFGDIR="$TEST_TMPDIR/gam-config"
    mkdir -p "$GAMCFGDIR"
    echo '{"type":"service_account"}' > "$GAMCFGDIR/oauth2service.json"
    echo '{"token":"fake"}' > "$GAMCFGDIR/oauth2.txt"
    echo '{"installed":{"client_id":"fake"}}' > "$GAMCFGDIR/client_secrets.json"
    export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
    export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

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
    rm -rf "$SCRIPT_DIR/nori-slack-cli/dist"
}

# ── AGENTS.md generation ──────────────────────────────────────────

@test "~/AGENTS.md contains a header and source reference" {
    run "$SETUP"
    [ "$status" -eq 0 ]
    [ -f "$HOME/AGENTS.md" ]
    grep -q "^# " "$HOME/AGENTS.md"
    grep -q "Source:" "$HOME/AGENTS.md"
}

@test "~/AGENTS.md lists all five CLIs" {
    run "$SETUP"
    [ "$status" -eq 0 ]
    grep -q "nori-slack" "$HOME/AGENTS.md"
    if grep -q "nori-broker" "$HOME/AGENTS.md"; then return 1; fi
    grep -q "gws" "$HOME/AGENTS.md"
    grep -q "sprite" "$HOME/AGENTS.md"
    grep -q "gam" "$HOME/AGENTS.md"
    grep -qE "^- (\*\*)?aws" "$HOME/AGENTS.md"
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
    grep -q "gam" "$HOME/AGENTS.md"
}

@test "exits non-zero but writes AGENTS.md when nori-gam fails" {
    # Remove gam binary and GAMCFGDIR to trigger setup failure
    rm "$TEST_TMPDIR/bin/gam"
    unset GAMCFGDIR

    run "$SETUP"
    [ "$status" -ne 0 ]
    [ -f "$HOME/AGENTS.md" ]
    grep -q "nori-slack" "$HOME/AGENTS.md"
    grep -q "gws" "$HOME/AGENTS.md"
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
    grep -q "nori-slack" "$HOME/AGENTS.md"
    grep -q "gws" "$HOME/AGENTS.md"
    ! grep -q "sprite" "$HOME/AGENTS.md"
    grep -q "gam" "$HOME/AGENTS.md"
}

@test "exits non-zero but writes AGENTS.md when nori-aws-cli fails" {
    # Remove aws binary and credentials to trigger setup failure
    rm "$TEST_TMPDIR/bin/aws"
    unset AWS_ACCESS_KEY_ID
    unset AWS_SECRET_ACCESS_KEY

    run "$SETUP"
    [ "$status" -ne 0 ]
    [ -f "$HOME/AGENTS.md" ]
    grep -q "nori-slack" "$HOME/AGENTS.md"
    grep -q "gws" "$HOME/AGENTS.md"
    grep -q "sprite" "$HOME/AGENTS.md"
    grep -q "gam" "$HOME/AGENTS.md"
    ! grep -q "aws" "$HOME/AGENTS.md"
}

@test "continues running remaining setups after one fails" {
    # Make nori-slack-cli fail, verify gws, sprites, and gam still ran
    cat > "$TEST_TMPDIR/bin/npm" <<STUB
#!/bin/bash
echo "npm \$*" >> "$TEST_TMPDIR/npm_calls.log"
if [[ "\$1" == "run" && "\$2" == "build" ]]; then exit 1; fi
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/npm"

    run "$SETUP"
    [ "$status" -ne 0 ]
    # Verify gws, sprites, gam, and aws setup messages appear in output (they ran)
    [[ "$output" == *"Google Workspace CLI is ready"* ]]
    [[ "$output" == *"Sprite CLI is ready"* ]]
    [[ "$output" == *"GAM is ready"* ]]
    [[ "$output" == *"AWS CLI is ready"* ]]
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
    [[ "$output" == *"nori-gam"*"OK"* ]]
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

    # Remove gam and config (breaks nori-gam)
    rm "$TEST_TMPDIR/bin/gam"
    unset GAMCFGDIR

    # Remove aws and credentials (breaks nori-aws-cli)
    rm "$TEST_TMPDIR/bin/aws"
    unset AWS_ACCESS_KEY_ID
    unset AWS_SECRET_ACCESS_KEY

    run "$SETUP"
    [ "$status" -ne 0 ]
    [ -f "$HOME/AGENTS.md" ]
    grep -q "# Agent CLIs" "$HOME/AGENTS.md"
    ! grep -q "nori-slack" "$HOME/AGENTS.md"
    ! grep -q "nori-broker" "$HOME/AGENTS.md"
    ! grep -q "gws" "$HOME/AGENTS.md"
    ! grep -q "sprite" "$HOME/AGENTS.md"
    ! grep -q "gam" "$HOME/AGENTS.md"
    ! grep -q "aws" "$HOME/AGENTS.md"
}

# ── bin/ directory (toolshed) ─────────────────────────────────────

@test "setup.sh places nori-slack in bin/ on success" {
    run "$SETUP"
    [ "$status" -eq 0 ]
    [ -e "$SCRIPT_DIR/bin/nori-slack" ]
    # Target must be a relative path so it works in any clone location
    local target
    target="$(readlink "$SCRIPT_DIR/bin/nori-slack")"
    [ "$target" = "../nori-slack-cli/dist/index.js" ]
}

@test "setup.sh does not place nori-broker in bin/" {
    run "$SETUP"
    [ "$status" -eq 0 ]
    [ ! -e "$SCRIPT_DIR/bin/nori-broker" ]
}

@test "setup.sh removes stale bin/nori-slack when build fails" {
    # Pre-create a stale symlink to verify cleanup
    mkdir -p "$SCRIPT_DIR/bin"
    ln -sf ../nori-slack-cli/dist/index.js "$SCRIPT_DIR/bin/nori-slack"

    # Make npm build fail
    cat > "$TEST_TMPDIR/bin/npm" <<STUB
#!/bin/bash
echo "npm \$*" >> "$TEST_TMPDIR/npm_calls.log"
if [[ "\$1" == "run" && "\$2" == "build" ]]; then exit 1; fi
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/npm"

    run "$SETUP"
    [ "$status" -ne 0 ]
    [ ! -e "$SCRIPT_DIR/bin/nori-slack" ]
}

@test "setup.sh bin/nori-slack survives multiple runs" {
    run "$SETUP"
    [ "$status" -eq 0 ]
    [ -e "$SCRIPT_DIR/bin/nori-slack" ]

    run "$SETUP"
    [ "$status" -eq 0 ]
    [ -e "$SCRIPT_DIR/bin/nori-slack" ]
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
    grep -q "nori-slack" "$HOME/AGENTS.md"
}

# ── CAPABILITIES.md inclusion ─────────────────────────────────────

@test "~/AGENTS.md includes capability text from CAPABILITIES.md files" {
    cat > "$SCRIPT_DIR/nori-slack-cli/CAPABILITIES.md" <<'EOF'
Slack Web API CLI. Call any Slack API method, paginate results, preview with dry-run.
- Send and manage messages, reactions, and threads
- Manage channels: create, archive, invite/remove members
EOF

    run "$SETUP"
    [ "$status" -eq 0 ]
    grep -q "Send and manage messages" "$HOME/AGENTS.md"
    grep -q "Manage channels" "$HOME/AGENTS.md"
}

@test "~/AGENTS.md includes capabilities for multiple tools" {
    cat > "$SCRIPT_DIR/nori-aws-cli/CAPABILITIES.md" <<'EOF'
AWS CLI v2.
- EC2: launch, terminate, list instances
- S3: upload, download, list buckets
EOF

    cat > "$SCRIPT_DIR/nori-slack-cli/CAPABILITIES.md" <<'EOF'
Slack Web API CLI.
- Send and manage messages
EOF

    run "$SETUP"
    [ "$status" -eq 0 ]
    grep -q "EC2: launch" "$HOME/AGENTS.md"
    grep -q "S3: upload" "$HOME/AGENTS.md"
    grep -q "Send and manage messages" "$HOME/AGENTS.md"
}

@test "~/AGENTS.md falls back to one-liner when CAPABILITIES.md is missing" {
    rm -f "$SCRIPT_DIR/nori-slack-cli/CAPABILITIES.md"

    run "$SETUP"
    [ "$status" -eq 0 ]
    # Should still list the tool with fallback one-liner
    grep -q "nori-slack" "$HOME/AGENTS.md"
}

@test "~/AGENTS.md capabilities are indented under tool name" {
    cat > "$SCRIPT_DIR/nori-slack-cli/CAPABILITIES.md" <<'EOF'
Slack Web API CLI.
- Send messages
EOF

    run "$SETUP"
    [ "$status" -eq 0 ]
    grep -q "^  - Send messages" "$HOME/AGENTS.md"
}

@test "~/AGENTS.md skips capabilities for failed tools even if CAPABILITIES.md exists" {
    cat > "$SCRIPT_DIR/nori-slack-cli/CAPABILITIES.md" <<'EOF'
Slack Web API CLI.
- Send messages
EOF

    # Make slack build fail
    cat > "$TEST_TMPDIR/bin/npm" <<STUB
#!/bin/bash
echo "npm \$*" >> "$TEST_TMPDIR/npm_calls.log"
if [[ "\$1" == "run" && "\$2" == "build" ]]; then exit 1; fi
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/npm"

    run "$SETUP"
    [ "$status" -ne 0 ]
    ! grep -q "Send messages" "$HOME/AGENTS.md"
}

