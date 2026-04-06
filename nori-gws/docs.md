# Noridoc: nori-gws

Path: @/nori-gws

### Overview
- A setup/configuration package for the `gws` CLI (`@googleworkspace/cli`) -- verifies installation and authentication prerequisites for non-interactive Google Workspace API access
- Unlike [@/nori-slack-cli](../nori-slack-cli/) which wraps `@slack/web-api` in a custom TypeScript CLI, this integration uses the existing `gws` Rust-based CLI directly and provides only a verification layer
- The sole executable is [setup.sh](setup.sh), a Bash script intended to be called during sprite provisioning

### How it fits into the larger codebase
- Lives alongside [@/nori-slack-cli](../nori-slack-cli/) in the `nori-integrations` monorepo, following the same broker integration pattern:

```
  Broker (nori-handroll)
    |
    |-- bootstrap: installs gws binary via npm-clis
    |-- config-builder: injects credentials as env vars
    |-- orgScript: calls setup.sh to verify everything works
```

- The broker's config-builder is responsible for writing `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` -- this package does not manage credentials, only validates them
- Broker changes for credential plumbing live in separate PRs against nori-handroll, not in this repository

### Core Implementation
- [setup.sh](setup.sh) runs a sequential validation chain with three exit codes:

| Exit Code | Meaning |
|-----------|---------|
| 0 | All checks passed, gws is ready |
| 1 | Missing prerequisite (binary not found, env var unset, credentials file missing or invalid) |
| 2 | Smoke test failed (API call unsuccessful) |

- The validation sequence:
  1. Checks `gws` is on PATH (attempts `npm install -g @googleworkspace/cli` if missing)
  2. Checks `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` env var is set
  3. Validates the credentials file exists on disk
  4. Validates the credentials file is valid JSON (uses `jq` if available, falls back to checking first character)
  5. Warns (but does not fail) if the credential type is `service_account`, because `gws` does not support domain-wide delegation or user impersonation
  6. Optionally runs `gws drive about get --format json` as a smoke test when `--smoke-test` flag is passed
- All diagnostic output goes to stderr; the script uses `set -euo pipefail` for strict error handling
- Every error message includes a `Source:` line pointing back to the script path for traceability

### Things to Know
- Authentication uses `authorized_user` credentials (OAuth2 refresh token) from a dedicated Workspace user, not service accounts. The `gws` CLI's Rust source (`auth.rs`) creates a `ServiceAccountAuthenticator` without a `subject` field, so domain-wide delegation / user impersonation is impossible. Service accounts can only access resources explicitly shared with the service account email. See [README.md](README.md) for the full auth analysis including credential resolution order, token lifecycle, and fleet distribution model
- The JSON validation has two code paths: a `jq`-based path that validates structure and checks the `type` field, and a fallback path that only checks the first byte is `{` when `jq` is not available
- The `--smoke-test` flag makes a real API call (`gws drive about get`), which requires the Drive API to be enabled in the GCP project and appropriate OAuth scopes

Created and maintained by Nori.
