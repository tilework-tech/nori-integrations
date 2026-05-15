# Noridoc: test

Path: @/test

### Overview
- Top-level bats tests for repo-wide scripts (as opposed to sub-package tests which live in their own `test/` directories)
- Currently tests the unified [`setup.sh`](../setup.sh) entry point

### How it fits into the larger codebase
- Each sub-package has its own `test/` directory for package-specific tests (e.g., [@/nori-slack-cli/test](../nori-slack-cli/test/), [@/nori-gws/test](../nori-gws/test/), [@/nori-sprites/test](../nori-sprites/test/))
- This directory covers cross-cutting behavior that spans multiple sub-packages, specifically the orchestration done by `setup.sh`

### Core Implementation
- Tests use a fake `$HOME` and stubbed binaries (`npm`, `gws`, `sprite`, `gam`, `aws`, `nori-newsletter`) in a temp directory to avoid side effects on the real system
- Stubs are shell scripts that record calls to a log file and return success, allowing tests to verify that `setup.sh` invokes the right commands without actually running them
- The npm stub simulates build output by creating `dist/index.js` so that `bin/` symlinks resolve correctly
- Environment variables required by sub-package setup scripts (`GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE`, `SPRITE_TOKEN`, `GAMCFGDIR`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `NEWSLETTER_CONFIG_FILE`, etc.) are set to test values in the bats `setup()` function
- Teardown cleans up both `$TEST_TMPDIR` and any artifacts `setup.sh` creates inside the repo directory (`bin/`, `nori-slack-cli/dist/`, `nori-broker-cli/dist/`)

### Things to Know
- Tests verify partial-failure tolerance: when a sub-package setup fails, `setup.sh` should exit non-zero but `~/AGENTS.md` should still be written -- it just omits the failed CLI while listing the successful ones. Each integration has a dedicated partial-failure test. Additional tests verify that remaining sub-packages continue running after an earlier failure and that the summary output includes FAIL/OK status per package
- Tests verify `bin/` directory behavior: successful builds place symlinks at `bin/nori-slack` and `bin/nori-broker` with relative targets (e.g., `../nori-slack-cli/dist/index.js`), stale symlinks are removed when builds fail, and symlinks survive multiple idempotent runs
- Tests verify `~/AGENTS.md` references the toolshed skill for detailed CLI usage guidance
- Tests verify idempotency: running `setup.sh` twice overwrites `~/AGENTS.md` rather than appending or failing
- Tests verify directory independence: `setup.sh` works regardless of the caller's working directory because it resolves `SCRIPT_DIR` from `BASH_SOURCE`

Created and maintained by Nori.
