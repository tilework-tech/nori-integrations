# Noridoc: nori-gam

Path: @/nori-gam

### Overview
- A setup/verification package for the GAM7 (GAMADV-XTD3) CLI, which provides access to Google Admin SDK (user management, group management, device management, etc.)
- Follows the shell-script-only pattern of [@/nori-sprites](../nori-sprites/) and [@/nori-aws-cli](../nori-aws-cli/) because GAM7 is already an agent-friendly CLI
- The sole executable is [setup.sh](setup.sh), a Bash script intended to be called during sprite provisioning

### How it fits into the larger codebase
- Lives in the `nori-integrations` monorepo alongside other integration packages, registered as one of the sub-packages invoked by [@/setup.sh](../setup.sh)
- Distinct from the Google Workspace `gws` CLI -- they target different Google APIs. The Workspace `gws` CLI is provided by the sprite base environment (installed on every sprite by the broker's base bootstrap bundle), not by this toolshed; this package only handles Admin SDK access:

| Tool | Google API Surface | CLI Binary | Credential Mechanism | Provided by |
|------|-------------------|------------|---------------------|-------------|
| Workspace CLI | Workspace APIs (Drive, Gmail, Calendar) | `gws` | `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` env var | broker base bootstrap bundle |
| nori-gam | Admin SDK (users, groups, devices, domains) | `gam` | `GAMCFGDIR` env var pointing to a directory of credential files | this toolshed |

- The broker's config-builder is responsible for writing `GAMCFGDIR` and populating the credential files; this package only validates them

### Core Implementation
- [setup.sh](setup.sh) runs a sequential validation chain with auto-installation capability:

| Exit Code | Meaning |
|-----------|---------|
| 0 | All checks passed, gam is ready |
| 1 | Missing prerequisite (binary install failed, env var unset, credentials missing) |
| 2 | Smoke test failed (API call unsuccessful) |

- The validation sequence:
  1. Checks `gam` is on PATH -- if missing, auto-installs via the official GAMADV-XTD3 installer script and adds `~/bin/gam7` to PATH
  2. Checks `GAMCFGDIR` env var is set
  3. Validates three credential files exist in `$GAMCFGDIR`: `oauth2service.json`, `oauth2.txt`, `client_secrets.json`
  4. Optionally runs `gam info domain` as a smoke test when `--smoke-test` flag is passed
- All diagnostic output goes to stderr; the script uses `set -euo pipefail` for strict error handling
- Every error message includes a `Source:` line for traceability

### Things to Know
- GAM7 uses a directory-based credential layout (`GAMCFGDIR`) rather than a single credential file, requiring three separate files for service account key, OAuth credentials, and GCP project config
- The auto-installer downloads from GitHub (`taers232c/GAMADV-XTD3`) and requires `curl`; if `curl` is unavailable and `gam` is not on PATH, setup fails with exit 1
- The `--smoke-test` flag makes a real API call (`gam info domain`), which requires Admin SDK API enabled, domain-wide delegation, and authorized scopes in the Workspace Admin Console

Created and maintained by Nori.
