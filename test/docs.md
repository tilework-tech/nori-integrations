# Noridoc: test

Path: @/test

### Overview
- Top-level bats tests for repo-wide scripts (as opposed to sub-package tests which live in their own `test/` directories)
- Currently tests the unified [setup.sh](../setup.sh) entry point

### How it fits into the larger codebase
- Each sub-package has its own `test/` directory for package-specific tests (e.g., [@/nori-gws/test](../nori-gws/test/), [@/nori-sprites/test](../nori-sprites/test/))
- This directory covers cross-cutting behavior that spans multiple sub-packages, specifically the orchestration done by [setup.sh](../setup.sh)

### Core Implementation
- Tests use a fake `$HOME` and stubbed binaries (`gws`, `sprite`, `gam`, `aws`) in a temp directory to avoid side effects on the real system
- Stubs are shell scripts that record calls to a log file and return success, allowing tests to verify that [setup.sh](../setup.sh) invokes the right commands without actually running them
- Environment variables required by sub-package setup scripts (`GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE`, `SPRITE_TOKEN`, `GAMCFGDIR`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) are set to test values in the bats `setup()` function
- Teardown cleans up `$TEST_TMPDIR` and any artifacts [setup.sh](../setup.sh) creates inside the repo directory (`bin/`)
- `CAPABILITIES.md` files are saved and restored around each test so tests can safely mutate them

### Things to Know
- Tests verify partial-failure tolerance: when a sub-package setup fails, [setup.sh](../setup.sh) should exit non-zero but `~/AGENTS.md` should still be written -- it just omits the failed CLI while listing the successful ones. Each integration ([@/nori-gws](../nori-gws/), [@/nori-sprites](../nori-sprites/), [@/nori-gam](../nori-gam/), [@/nori-aws-cli](../nori-aws-cli/)) has a dedicated partial-failure test. Additional tests verify that remaining sub-packages continue running after an earlier failure and that the summary output includes FAIL/OK status per package
- Tests verify `bin/` directory behavior: negative tests assert that neither `bin/nori-slack` nor `bin/nori-broker` are produced -- these CLIs are delivered via the broker bootstrap bundle, not this toolshed
- Tests verify `~/AGENTS.md` references the [@/skills/nori-integrations-toolshed](../skills/nori-integrations-toolshed/) skill for detailed CLI usage guidance
- Tests verify idempotency: running [setup.sh](../setup.sh) twice overwrites `~/AGENTS.md` rather than appending or failing
- Tests verify directory independence: [setup.sh](../setup.sh) works regardless of the caller's working directory because it resolves `SCRIPT_DIR` from `BASH_SOURCE`

Created and maintained by Nori.
