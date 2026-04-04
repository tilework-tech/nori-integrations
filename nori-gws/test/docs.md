# Noridoc: nori-gws/test

Path: @/nori-gws/test

### Overview
- Bats (Bash Automated Testing System) tests for [@/nori-gws/setup.sh](../setup.sh)
- Covers all failure modes (missing binary, missing env vars, invalid credentials) and success paths (normal run, smoke test pass/fail)

### How it fits into the larger codebase
- Follows the same test pattern as other shell-based tests in the monorepo -- uses bats rather than Vitest since the code under test is Bash, not TypeScript
- Tests are self-contained: each test creates a temp directory with a stubbed `gws` binary and a fake service account JSON, then tears it down after

### Core Implementation
- [test_setup.bats](test_setup.bats) uses a `setup()` function that creates a temporary environment for each test:
  - A fake `gws` binary in `$TEST_TMPDIR/bin/` that responds to `--version` and returns `{"ok":true}` for all other commands
  - A valid service account JSON file at `$TEST_TMPDIR/service-account.json`
  - All required env vars pre-set to valid values -- individual tests unset or override them to trigger specific failure paths
- Tests validate both exit codes and output content (checking for key substrings rather than exact messages)
- The smoke test failure case replaces the default `gws` stub with one that returns exit code 1 for non-version subcommands

### Things to Know
- The `PATH` override in `setup()` prepends `$TEST_TMPDIR/bin` so the stub `gws` takes priority -- the "gws not on PATH" test works by resetting PATH to `/usr/bin:/bin` only
- Tests that check credentials validation depend on `jq` being available on the test runner; the fallback code path (no `jq`) is not explicitly tested
- The non-service-account credential type test verifies the script warns but still exits 0, confirming the warning is non-blocking

Created and maintained by Nori.
