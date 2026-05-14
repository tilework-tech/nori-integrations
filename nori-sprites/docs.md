# Noridoc: nori-sprites

Path: @/nori-sprites

### Overview
- A setup/verification package for the `sprite` CLI -- ensures installation, authentication, and connectivity so coding agents can interact with other sprites in the same Fly.io organization
- Follows the same shell-script-only pattern as [@/nori-gws](../nori-gws/): the `sprite` CLI is already agent-usable, so this package provides only a verification layer, not a wrapper
- The sole executable is [setup.sh](setup.sh), a Bash script intended to be called during sprite provisioning

### How it fits into the larger codebase
- Lives alongside [@/nori-gws](../nori-gws/) in the `nori-integrations` monorepo, following the broker integration pattern:

```
  Broker
    |
    |-- bootstrap: sprite CLI auto-installed by setup.sh if missing
    |-- config-builder: injects SPRITE_TOKEN env var
    |-- orgScript: calls setup.sh to verify installation + auth + connectivity
```

- Unlike nori-gws where the broker installs the binary separately, nori-sprites self-installs the `sprite` CLI via `curl -fsSL https://sprites.dev/install.sh | sh` when it is not already on PATH
- Authentication is configured via `SPRITE_TOKEN` env var, which setup.sh passes to `sprite auth setup --token`; alternatively, an existing config file at `~/.sprites/sprites.json` satisfies the auth requirement

### Core Implementation
- [setup.sh](setup.sh) runs a sequential validation chain with three exit codes:

| Exit Code | Meaning |
|-----------|---------|
| 0 | All checks passed, sprite CLI is ready |
| 1 | Missing prerequisite (binary not installable, auth not configured, bad arguments) |
| 2 | Connectivity or verification failure (smoke test failed, specific sprite not found) |

- The validation sequence:
  1. Checks `sprite` is on PATH; if missing, auto-installs via `curl | sh` and adds `~/.local/bin` to PATH
  2. Checks for auth: existing config file at `~/.sprites/sprites.json` OR `SPRITE_TOKEN` env var (which triggers `sprite auth setup --token`)
  3. Optionally runs `sprite list` as a smoke test when `--smoke-test` flag is passed
  4. Optionally verifies specific sprites are present in the list output when `--sprites name1,name2,...` is passed (exact-match grep per name)
- The `--sprites` flag implicitly triggers the smoke test (runs `sprite list` even without `--smoke-test`)
- All diagnostic output goes to stderr; the script uses `set -euo pipefail` for strict error handling
- Every error message includes a `Source:` line pointing back to the script path for traceability

### Things to Know
- The auto-install behavior differentiates this from nori-gws, where the binary must already be present -- here, `setup.sh` is self-bootstrapping
- Sprite verification uses exact line matching (`grep -q "^${sprite_name}$"`) against `sprite list` output, so names must match exactly as they appear in the list
- The script calls `sprite list` twice in the success path when no flags are passed: once would be during the smoke test (if enabled) and once at the end to report the sprite count

Created and maintained by Nori.
