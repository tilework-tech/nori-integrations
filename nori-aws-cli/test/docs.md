# Noridoc: nori-aws-cli/test

Path: @/nori-aws-cli/test

### Overview
- Bats (Bash Automated Testing System) tests for [@/nori-aws-cli/setup.sh](../setup.sh)
- Covers the success path, auto-installation, missing prerequisites, all three credential sources, and smoke test pass/fail

### How it fits into the larger codebase
- Follows the same test pattern as other shell-based tests in the monorepo ([@/nori-gws/test](../../nori-gws/test/), [@/nori-sprites/test](../../nori-sprites/test/)) -- uses bats since the code under test is Bash
- Tests are self-contained: each test creates a temp directory with a stubbed `aws` binary and fake credentials, then tears it down after

### Core Implementation
- [test_setup.bats](test_setup.bats) uses a `setup()` function that creates a temporary environment for each test:
  - A fake `aws` binary in `$TEST_TMPDIR/bin/` that responds to `--version` and `sts get-caller-identity`
  - `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` pre-set as environment variables -- individual tests unset or override as needed to trigger specific failure paths
  - A fake `$HOME` so tests writing to `~/.aws/` do not affect the real system
- Credential source tests cover all three detection methods: env vars (default), `~/.aws/credentials` file (unset env vars, write file), and `AWS_PROFILE` + `~/.aws/config` (unset env vars, set profile)
- The auto-install test replaces the `aws` stub with layered fakes: a `curl` stub (no-op), an `unzip` stub that creates `/tmp/aws/install`, and the install script that places a new `aws` binary on PATH
- The smoke test failure case replaces the default `aws` stub with one that returns exit 255 for `sts get-caller-identity`

### Things to Know
- PATH is restricted to `$TEST_TMPDIR/bin:/usr/bin:/bin` so no real system `aws` leaks into tests
- The auto-install test exercises the full install flow (curl -> unzip -> /tmp/aws/install) using nested heredoc stubs, which makes the test somewhat complex but validates the real control flow end-to-end
- Tests validate both exit codes and output content using substring matching rather than exact message comparison

Created and maintained by Nori.
