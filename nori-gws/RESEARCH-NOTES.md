# Research Notes

## Decision: Wrap gws, not build from scratch

The `gws` CLI (github.com/googleworkspace/cli, npm `@googleworkspace/cli`) already exists as a
discovery-based, agent-friendly CLI for all Google Workspace APIs. It is written in Rust, distributed
via npm, and covers 18 services (Gmail, Drive, Sheets, Calendar, Docs, Slides, Chat, Tasks, Forms,
Keep, Meet, etc.).

Rather than building a TypeScript wrapper (like nori-slack-cli wraps `@slack/web-api`), we use `gws`
directly. The integration is a setup/configuration package, not a CLI wrapper.

## gws Key Facts

- **Version**: 0.22.5 (pre-v1.0, actively maintained — 10 releases in 13 days as of March 2026)
- **Stars**: 23.7k on GitHub
- **Install**: `npm install -g @googleworkspace/cli@0.22.5`
- **Architecture**: Discovery-based — fetches Google Discovery Service docs at runtime, builds command surface dynamically
- **Output**: JSON by default, also supports table/csv/yaml
- **Agent features**: `--dry-run`, `--format json`, `--page-all` (NDJSON), `gws schema` for method introspection, `gws generate-skills`

## Authentication for Non-Interactive Use

Two env vars are all that's needed for service account auth:

```
GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/service-account.json
GOOGLE_WORKSPACE_CLI_IMPERSONATED_USER=admin@domain.com
```

No `gws auth setup` or `gws auth login` required. The CLI detects the service account JSON and impersonation target automatically.

### Credential resolution order
1. `GOOGLE_WORKSPACE_CLI_TOKEN` (pre-obtained access token)
2. `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` (service account JSON or exported OAuth)
3. Encrypted store (`~/.config/gws/credentials.enc`)
4. Plaintext store (`~/.config/gws/credentials.json`)
5. Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS`)

### Service account JSON format
Standard Google format — the same file you download from GCP Console:
```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...",
  "client_email": "...@...iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

### Domain-wide delegation prerequisites (admin console, not our code)
1. GCP Console: Enable "Domain-wide Delegation" on the service account
2. Workspace Admin Console: Security > API Controls > Domain-wide Delegation, add client ID + scopes
3. Required scopes depend on which APIs are needed

## Key gws Environment Variables

| Variable | Purpose |
|----------|---------|
| `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` | Path to service account JSON |
| `GOOGLE_WORKSPACE_CLI_IMPERSONATED_USER` | Email for domain-wide delegation |
| `GOOGLE_WORKSPACE_CLI_TOKEN` | Pre-obtained access token (highest priority) |
| `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` | Override config dir (default: `~/.config/gws`) |
| `GOOGLE_WORKSPACE_CLI_LOG` | Log level (e.g., `gws=debug`) |

## gws Command Structure

```
gws <service> <resource> [sub-resource] <method> [flags]
```

Examples:
```bash
gws drive files list --params '{"pageSize": 5}'
gws gmail users messages list --params '{"userId": "me", "maxResults": 10}'
gws sheets spreadsheets values get --params '{"spreadsheetId": "...", "range": "Sheet1!A1:B10"}'
```

## Integration Pattern (from broker codebase)

The existing Slack integration follows this flow:
1. **Bootstrap**: `npm-clis/package.json` installs `slack-mcp-server` globally on sprites
2. **Credentials**: `config-builder.ts` writes `slack-env.sh` exporting `SLACK_BOT_TOKEN` + `SLACK_TEAM_ID`
3. **MCP**: `mcp-servers.ts` registers Slack as an MCP server with env vars

For Google Workspace:
1. **Bootstrap**: Add `@googleworkspace/cli` to npm-clis package
2. **Credentials**: Write `google-workspace-env.sh` exporting credential file path + impersonated user
3. **Setup script**: Verify install, auth, and run smoke test

## Deliverables

- `nori-gws/setup.sh` — Setup/verification script
- `nori-gws/test/` — Tests (bats format, matching remote-handoff pattern)
- Broker changes (credential plumbing) are separate PRs against nori-handroll
