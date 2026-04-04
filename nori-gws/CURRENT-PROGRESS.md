# Current Progress

## Status: Setup script with tests

The nori-gws integration uses the existing `gws` CLI (@googleworkspace/cli) directly rather than building a custom wrapper. The deliverable is a setup/verification script with 9 passing bats tests.

## Completed

### Commit 1: Research and setup script
- **Decision**: Use `gws` directly instead of building a TypeScript wrapper (like nori-slack-cli). The `gws` CLI already has JSON output, --dry-run, service account auth, discovery-based command surface, and agent skills.
- **`setup.sh`**: Bash script that verifies gws installation and Google Workspace auth configuration
  - Checks `gws` on PATH
  - Checks `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` is set and points to valid JSON
  - Checks `GOOGLE_WORKSPACE_CLI_IMPERSONATED_USER` is set
  - Warns if credentials are not `service_account` type (doesn't fail — could be exported OAuth)
  - Optional `--smoke-test` flag runs `gws drive about get`
  - Exit codes: 0=ready, 1=missing prerequisite, 2=smoke test failed
  - All errors include source path and actionable suggestions
- **9 bats tests**: Covers missing binary, missing env vars, bad credentials file, non-service-account warning, success path, smoke test pass/fail
- **RESEARCH-NOTES.md**: Documents gws capabilities, auth setup, env vars, command structure, integration patterns
- **docs.md files**: Noridocs for nori-gws/, nori-gws/test/, and root

## What Works
- `setup.sh` validates prerequisites without requiring real Google credentials
- `setup.sh --smoke-test` runs an actual API call to verify end-to-end auth
- All output follows agent-friendly patterns (stderr for diagnostics, structured error messages)

## Next Steps
- Broker changes (nori-handroll): Add `@googleworkspace/cli` to bootstrap npm-clis, add credential storage/injection to config-builder
- Agent skill file: Create a CLAUDE.md snippet or skill that teaches agents how to use `gws`
- Integration endpoint: Add `PUT /integrations/google-workspace` to broker HTTP endpoints
