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

    # Stub nori-newsletter
    cat > "$TEST_TMPDIR/bin/nori-newsletter" <<'STUB'
#!/bin/bash
if [[ "$1" == "--version" ]]; then echo "1.0.0"; exit 0; fi
if [[ "$1" == "contacts" && "$2" == "list" ]]; then echo '[]'; exit 0; fi
echo '{"ok":true}'
exit 0
STUB
    chmod +x "$TEST_TMPDIR/bin/nori-newsletter"

    # Restrict PATH so only our stubs are used (no real gws/sprite/gam/aws/nori-newsletter leaking in)
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
    export AWS_REGION="us-east-1"
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

@test "~/AGENTS.md lists all five CLIs" {
    run "$SETUP"
    [ "$status" -eq 0 ]
    grep -q "gws" "$HOME/AGENTS.md"
    grep -q "sprite" "$HOME/AGENTS.md"
    grep -q "gam" "$HOME/AGENTS.md"
    grep -qE "^- (\*\*)?aws" "$HOME/AGENTS.md"
    grep -q "nori-newsletter" "$HOME/AGENTS.md"
}

# ── Partial failure tolerance ─────────────────────────────────────

@test "exits non-zero but writes AGENTS.md when nori-gws fails" {
    # Remove gws to trigger setup failure
    rm "$TEST_TMPDIR/bin/gws"

    run "$SETUP"
    [ "$status" -ne 0 ]
    [ -f "$HOME/AGENTS.md" ]
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
    grep -q "gws" "$HOME/AGENTS.md"
    grep -q "sprite" "$HOME/AGENTS.md"
    grep -q "gam" "$HOME/AGENTS.md"
    ! grep -qE "^- (\*\*)?aws" "$HOME/AGENTS.md"
}

@test "exits non-zero but writes AGENTS.md when nori-newsletter-cli fails" {
    # Remove nori-newsletter binary and config to trigger setup failure
    rm "$TEST_TMPDIR/bin/nori-newsletter"
    unset NEWSLETTER_CONFIG_FILE

    run "$SETUP"
    [ "$status" -ne 0 ]
    [ -f "$HOME/AGENTS.md" ]
    grep -q "gws" "$HOME/AGENTS.md"
    grep -q "sprite" "$HOME/AGENTS.md"
    grep -q "gam" "$HOME/AGENTS.md"
    grep -qE "^- (\*\*)?aws" "$HOME/AGENTS.md"
    ! grep -q "nori-newsletter" "$HOME/AGENTS.md"
}

@test "continues running remaining setups after one fails" {
    # Make nori-gws fail, verify sprites, gam, aws, and newsletter still ran
    rm "$TEST_TMPDIR/bin/gws"

    run "$SETUP"
    [ "$status" -ne 0 ]
    [[ "$output" == *"Sprite CLI is ready"* ]]
    [[ "$output" == *"GAM is ready"* ]]
    [[ "$output" == *"AWS CLI is ready"* ]]
    [[ "$output" == *"nori-newsletter-cli is ready"* ]]
}

@test "prints summary with FAIL/OK status for each package" {
    # Make nori-gws fail
    rm "$TEST_TMPDIR/bin/gws"

    run "$SETUP"
    [ "$status" -ne 0 ]
    [[ "$output" == *"nori-gws"*"FAIL"* ]]
    [[ "$output" == *"nori-gam"*"OK"* ]]
}

@test "writes AGENTS.md with just header when all packages fail" {
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

    # Remove nori-newsletter and config (breaks nori-newsletter-cli)
    rm "$TEST_TMPDIR/bin/nori-newsletter"
    unset NEWSLETTER_CONFIG_FILE

    run "$SETUP"
    [ "$status" -ne 0 ]
    [ -f "$HOME/AGENTS.md" ]
    grep -q "# Agent CLIs" "$HOME/AGENTS.md"
    ! grep -q "gws" "$HOME/AGENTS.md"
    ! grep -q "sprite" "$HOME/AGENTS.md"
    ! grep -q "gam" "$HOME/AGENTS.md"
    ! grep -q "aws" "$HOME/AGENTS.md"
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
    grep -q "gws" "$HOME/AGENTS.md"
}

# ── CAPABILITIES.md inclusion ─────────────────────────────────────

@test "~/AGENTS.md includes capability text from CAPABILITIES.md files" {
    cat > "$SCRIPT_DIR/nori-gws/CAPABILITIES.md" <<'EOF'
Google Workspace CLI. Access Drive, Gmail, Calendar, Sheets, and Docs.
- List, search, and manage Drive files
- Read and send Gmail messages
EOF

    run "$SETUP"
    [ "$status" -eq 0 ]
    grep -q "List, search, and manage Drive files" "$HOME/AGENTS.md"
    grep -q "Read and send Gmail messages" "$HOME/AGENTS.md"
}

@test "~/AGENTS.md includes capabilities for multiple tools" {
    cat > "$SCRIPT_DIR/nori-aws-cli/CAPABILITIES.md" <<'EOF'
AWS CLI v2.
- EC2: launch, terminate, list instances
- S3: upload, download, list buckets
EOF

    cat > "$SCRIPT_DIR/nori-gws/CAPABILITIES.md" <<'EOF'
Google Workspace CLI.
- List and manage Drive files
EOF

    run "$SETUP"
    [ "$status" -eq 0 ]
    grep -q "EC2: launch" "$HOME/AGENTS.md"
    grep -q "S3: upload" "$HOME/AGENTS.md"
    grep -q "List and manage Drive files" "$HOME/AGENTS.md"
}

@test "~/AGENTS.md falls back to one-liner when CAPABILITIES.md is missing" {
    rm -f "$SCRIPT_DIR/nori-gws/CAPABILITIES.md"

    run "$SETUP"
    [ "$status" -eq 0 ]
    # Should still list the tool with fallback one-liner
    grep -q "gws" "$HOME/AGENTS.md"
}

@test "~/AGENTS.md capabilities are indented under tool name" {
    cat > "$SCRIPT_DIR/nori-gws/CAPABILITIES.md" <<'EOF'
Google Workspace CLI.
- List Drive files
EOF

    run "$SETUP"
    [ "$status" -eq 0 ]
    grep -q "^  - List Drive files" "$HOME/AGENTS.md"
}

@test "~/AGENTS.md skips capabilities for failed tools even if CAPABILITIES.md exists" {
    cat > "$SCRIPT_DIR/nori-gws/CAPABILITIES.md" <<'EOF'
Google Workspace CLI.
- List Drive files
EOF

    # Make gws fail
    rm "$TEST_TMPDIR/bin/gws"

    run "$SETUP"
    [ "$status" -ne 0 ]
    ! grep -q "List Drive files" "$HOME/AGENTS.md"
}
