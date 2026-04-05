# Noridoc: test

Path: @/test

### Overview
- Top-level bats tests for repo-wide scripts (as opposed to sub-package tests which live in their own `test/` directories)
- Currently tests the unified [`setup.sh`](../setup.sh) entry point

### How it fits into the larger codebase
- Each sub-package has its own `test/` directory for package-specific tests (e.g., [@/nori-slack-cli/test](../nori-slack-cli/test/), [@/nori-gws/test](../nori-gws/test/), [@/nori-sprites/test](../nori-sprites/test/))
- This directory covers cross-cutting behavior that spans multiple sub-packages, specifically the orchestration done by `setup.sh`

### Core Implementation
- Tests use a fake `$HOME` and stubbed binaries (`npm`, `gws`, `sprite`) in a temp directory to avoid side effects on the real system
- Stubs are shell scripts that record calls to a log file and return success, allowing tests to verify that `setup.sh` invokes the right commands without actually running them
- Environment variables required by sub-package setup scripts (`GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE`, `SPRITE_TOKEN`, etc.) are set to test values in the bats `setup()` function

### Things to Know
- Tests verify failure propagation: when a sub-package setup fails, `setup.sh` should exit non-zero and `~/AGENTS.md` should not exist -- this validates the `set -euo pipefail` contract
- Tests verify idempotency: running `setup.sh` twice overwrites `~/AGENTS.md` rather than appending or failing
- Tests verify directory independence: `setup.sh` works regardless of the caller's working directory because it resolves `SCRIPT_DIR` from `BASH_SOURCE`

Created and maintained by Nori.
