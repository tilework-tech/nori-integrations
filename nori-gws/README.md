# nori-gws

Setup and verification layer for the [Google Workspace CLI](https://github.com/googleworkspace/cli) (`gws`). This package does not wrap `gws` — it validates that `gws` is installed and properly authenticated, then agents use `gws` directly.

## Auth Model

### Why authorized-user credentials, not service accounts

The `gws` CLI supports two credential types: `authorized_user` and `service_account`. For Workspace API access (Gmail, Drive, Calendar, etc.), service accounts are effectively useless without domain-wide delegation + user impersonation. The `gws` CLI does not implement impersonation — its Rust source creates a `ServiceAccountAuthenticator` via `yup_oauth2` but never sets a `subject` field. This means a service account can only access resources explicitly shared with its service account email (e.g., `my-sa@my-project.iam.gserviceaccount.com`), which in practice is nothing useful.

The recommended approach is to use `authorized_user` credentials from a dedicated Workspace user (e.g., `agents@yourdomain.com`).

### How gws resolves credentials

From the `gws` source code (`crates/google-workspace-cli/src/auth.rs`), credentials are resolved in this order:

1. `GOOGLE_WORKSPACE_CLI_TOKEN` env var — raw OAuth2 access token (highest priority, short-lived)
2. `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` env var — path to a plaintext JSON credentials file
3. Encrypted credentials at `~/.config/gws/credentials.enc`
4. Plaintext credentials at `~/.config/gws/credentials.json`
5. Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS` env var or `~/.config/gcloud/application_default_credentials.json`)

This package uses option 2: `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE`.

### Token lifecycle

The exported credentials file contains a **refresh token**, not just an access token. Refresh tokens are long-lived — `gws` uses them automatically to mint new short-lived access tokens without any human interaction. A refresh token remains valid until:

- The user explicitly revokes it (Google Account > Security > Third-party apps)
- The `agents@` account password is changed
- A Workspace admin revokes OAuth grants for the account
- Google's security heuristics invalidate it (e.g., 6 months of inactivity)
- The per-user-per-client token limit (~50) is exceeded

### Fleet distribution

Multiple machines can share the same credentials file simultaneously. Each machine independently uses the same refresh token to mint its own short-lived access tokens. Google does not limit how many machines use a single refresh token concurrently.

**Do not** run `gws auth login` on each machine. Each login creates a new refresh token, and exceeding the ~50 token limit silently revokes the oldest tokens. Instead, export once and copy everywhere.

## Setup

### 1. Create a dedicated Workspace user

Create a user like `agents@yourdomain.com` in your Google Workspace Admin Console. Grant it access to the resources your agents need by sharing Drive files, Calendar events, etc. directly with this account. Scoping is controlled by what you share — the account can only see what's explicitly available to it.

### 2. Authenticate once

On any machine with a browser:

```bash
# Install gws if needed
npm install -g @googleworkspace/cli

# Login as the dedicated user — opens a browser for OAuth consent
gws auth login

# Export the credentials (includes the long-lived refresh token)
gws auth export --unmasked > /secure/path/gws-creds.json
chmod 600 /secure/path/gws-creds.json
```

**Important:** The exported file contains a long-lived refresh token. Treat it like a password — store it with restricted file permissions, do not commit it to version control, and distribute it via a secrets manager rather than plain file copy.

### 3. Configure the environment

On every machine that needs access:

```bash
export GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=/path/to/gws-creds.json
```

### 4. Verify

```bash
# Basic check (validates env var, file exists, JSON valid)
bash nori-gws/setup.sh

# Full check (makes a real API call to Drive)
bash nori-gws/setup.sh --smoke-test
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` | Yes | Path to the exported credentials JSON file |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | Missing prerequisite (binary, env var, credentials file) |
| 2 | Smoke test failed (API call unsuccessful) |

## Troubleshooting

**Smoke test fails with auth error:**
The refresh token may have been revoked. Re-run `gws auth login` as the dedicated user and re-export.

**"gws not found":**
The setup script will attempt `npm install -g @googleworkspace/cli` automatically. If npm is not available, install `gws` manually via `brew install googleworkspace-cli` or `cargo install --git https://github.com/googleworkspace/cli --locked`.

**Warning about service_account credentials:**
The `gws` CLI does not support user impersonation. A service account will only be able to access resources explicitly shared with the service account's email. Use `authorized_user` credentials instead.
