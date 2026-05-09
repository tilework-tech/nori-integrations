# Noridoc: test

Path: @/test

### Overview
- Top-level bats tests for repo-wide scripts (as opposed to sub-package tests which live in their own `test/` directories)
- Currently tests the unified [setup.sh](../setup.sh) entry point

### How it fits into the larger codebase
- Each sub-package has its own `test/` directory for package-specific tests (see [@/nori-slack-cli/test](../nori-slack-cli/test/), [@/nori-gws/test](../nori-gws/test/), [@/nori-sprites/test](../nori-sprites/test/))
- This directory covers cross-cutting behavior that spans multiple sub-packages, specifically the orchestration done by [setup.sh](../setup.sh)

### Core Implementation
- Tests use a fake `$HOME` and stubbed binaries (`npm`, `gws`, `sprite`, `gam`, `aws`) in a temp directory to avoid side effects on the real system
- Stubs are shell scripts that record calls to a log file and return success, allowing tests to verify that [setup.sh](../setup.sh) invokes the right commands without actually running them
- The `npm` stub simulates build output by creating `dist/index.js` so that `bin/` symlinks resolve correctly
- Environment variables required by sub-package setup scripts (`GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE`, `SPRITE_TOKEN`, `GAMCFGDIR`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) are set to test values in the bats `setup()` function
- Teardown cleans up `$TEST_TMPDIR` and any artifacts [setup.sh](../setup.sh) creates inside the repo directory (`bin/` and `nori-slack-cli/dist/`)

### Things to Know
- Tests verify partial-failure tolerance: when a sub-package setup fails, [setup.sh](../setup.sh) should exit non-zero but `~/AGENTS.md` should still be written -- it just omits the failed CLI while listing the successful ones. Each integration ([@/nori-slack-cli](../nori-slack-cli/), [@/nori-gws](../nori-gws/), [@/nori-sprites](../nori-sprites/) plus the others) has a dedicated partial-failure test. Additional tests verify that remaining sub-packages continue running after an earlier failure and that the summary output includes FAIL/OK status per package
- Tests verify `bin/` directory behavior: a successful build places `bin/nori-slack` with a relative target (`../nori-slack-cli/dist/index.js`), the symlink is removed when the slack build fails, and the symlink survives multiple idempotent runs. A negative test asserts that `bin/nori-broker` is never produced -- the broker CLI is intentionally not part of this toolshed (its canonical source lives in `sessions/broker/cli/` and is delivered via the broker bootstrap bundle)
- Tests verify `~/AGENTS.md` references the [@/skills/nori-integrations-toolshed](../skills/nori-integrations-toolshed/) skill for detailed CLI usage guidance
- Tests verify idempotency: running [setup.sh](../setup.sh) twice overwrites `~/AGENTS.md` rather than appending or failing
- Tests verify directory independence: [setup.sh](../setup.sh) works regardless of the caller's working directory because it resolves `SCRIPT_DIR` from `BASH_SOURCE`

Created and maintained by Nori.
