# Noridoc: nori-gws/test

Path: @/nori-gws/test

### Overview
- Bats (Bash Automated Testing System) tests for [@/nori-gws/setup.sh](../setup.sh)
- Covers all failure modes (missing binary, missing env vars, invalid credentials) and success paths (normal run, smoke test pass/fail)

### How it fits into the larger codebase
- Follows the same test pattern as other shell-based tests in the monorepo -- uses bats rather than Vitest since the code under test is Bash, not TypeScript
- Tests are self-contained: each test creates a temp directory with a stubbed `gws` binary and a fake `authorized_user` credentials JSON, then tears it down after

### Core Implementation
- [test_setup.bats](test_setup.bats) uses a `setup()` function that creates a temporary environment for each test:
  - A fake `gws` binary in `$TEST_TMPDIR/bin/` that responds to `--version` and returns `{"ok":true}` for all other commands
  - A valid `authorized_user` JSON file at `$TEST_TMPDIR/authorized-user.json`
  - `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` pre-set -- individual tests unset or override as needed to trigger specific failure paths
- Tests validate both exit codes and output content (checking for key substrings rather than exact messages)
- The smoke test failure case replaces the default `gws` stub with one that returns exit code 1 for non-version subcommands

### Things to Know
- PATH is restricted to `$TEST_TMPDIR/bin:/usr/bin:/bin` so no real system `gws` leaks into tests -- tests for "gws not on PATH" remove the stub and keep this restricted PATH
- Tests that check credentials validation depend on `jq` being available on the test runner; the fallback code path (no `jq`) is not explicitly tested
- The `service_account` credential type test verifies the script warns (about lack of impersonation support) but still exits 0; the `authorized_user` test verifies no warning is emitted

Created and maintained by Nori.
