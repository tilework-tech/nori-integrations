# Noridoc: nori-sprites/test

Path: @/nori-sprites/test

### Overview
- Bats test suite for [@/nori-sprites/setup.sh](../setup.sh), validating the auto-install, authentication, smoke test, and sprite verification behaviors
- Uses stub binaries and a controlled HOME directory to avoid real CLI calls or network access

### How it fits into the larger codebase
- Follows the same testing approach as [@/nori-gam/test](../../nori-gam/test/) -- Bats-based shell tests with stubbed binaries
- Each test manipulates the test environment (removing the stub binary, unsetting env vars, swapping in failing stubs) to isolate a single code path in setup.sh

### Core Implementation
- [test_setup.bats](test_setup.bats) creates a temporary directory as HOME, populates it with a stub `sprite` binary and a fake `~/.sprites/sprites.json` config file in the `setup()` fixture
- The stub binary handles `--version`, `list`, and `auth` subcommands, returning fixed output (three sprites: `sprite-alpha`, `sprite-beta`, `sprite-gamma`)
- Tests cover: auto-install when binary is missing, failure when curl is unavailable, auth via SPRITE_TOKEN, auth failure when no token or config, success path, smoke test pass/fail, and `--sprites` verification pass/fail

### Things to Know
- The auto-install test creates a fake `curl` that outputs a shell script which itself creates a fake `sprite` binary at `~/.local/bin/sprite` -- this tests the full install-then-re-check-PATH flow without network access
- The smoke test failure test swaps in a stub where `sprite list` exits non-zero, verifying exit code 2 propagation

Created and maintained by Nori.
