# Noridoc: nori-newsletter-cli/test

Path: @/nori-newsletter-cli/test

### Overview
- Bats (Bash Automated Testing System) tests for [@/nori-newsletter-cli/setup.sh](../setup.sh)
- Covers the success path, npm-based auto-installation, all three AWS credential sources, config file validation, and smoke test pass/fail

### How it fits into the larger codebase
- Follows the same test pattern as other shell-based tests in the monorepo ([@/nori-aws-cli/test](../../nori-aws-cli/test/), [@/nori-gws/test](../../nori-gws/test/), [@/nori-sprites/test](../../nori-sprites/test/)) -- uses bats since the code under test is Bash
- Tests are self-contained: each test creates a temp directory with stubbed binaries and fake config, then tears it down after

### Core Implementation
- [test_setup.bats](test_setup.bats) uses a `setup()` function that creates a temporary environment for each test:
  - A fake `nori-newsletter` binary in `$TEST_TMPDIR/bin/` that responds to `--version`, `contacts list`, and `--help`
  - A stubbed `npm` binary for testing auto-installation
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, and `NEWSLETTER_CONFIG_FILE` pre-set -- individual tests unset or override as needed to trigger specific failure paths
  - A fake `$HOME` so tests writing to `~/.aws/` do not affect the real system
- Config validation tests cover missing env var, nonexistent file, invalid JSON, and missing required keys (partial config with only `contactListName` triggers the missing-keys error)
- Credential source tests cover all three detection methods: env vars (default), `~/.aws/credentials` file, and `AWS_PROFILE` + `~/.aws/config`
- The auto-install test replaces the npm stub with one that creates a `nori-newsletter` binary in the test bin directory upon `npm install -g`

### Things to Know
- PATH is restricted to `$TEST_TMPDIR/bin:/usr/bin:/bin` so no real system binaries leak into tests
- The auto-install test uses nested heredocs to have the npm stub create a new `nori-newsletter` binary, which makes the test complex but validates the real control flow
- Tests validate both exit codes and output content using substring matching rather than exact message comparison
- The smoke test failure case replaces the default `nori-newsletter` stub with one that returns exit 1 for `contacts list`

Created and maintained by Nori.
