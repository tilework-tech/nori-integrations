---
name: nori-integrations-toolshed
description: Documents the CLI tools available in the nori-integrations toolshed and how to use them.
---

# nori-integrations Toolshed

This toolshed provides CLI tools for interacting with third-party services.

## Available Tools

### nori-slack

Slack Web API CLI. Wraps the full Slack Web API surface in a single command.

```bash
# List all available Slack API methods
nori-slack list-methods

# Describe a specific method's parameters
nori-slack describe chat.postMessage

# Call a method
nori-slack chat.postMessage --channel C123456 --text "Hello"

# Paginate through results
nori-slack --paginate conversations.list --types public_channel

# Dry-run (validate without calling)
nori-slack --dry-run chat.postMessage --channel C123456 --text "Hello"
```

Requires: `SLACK_BOT_TOKEN` environment variable.

### gws

Google Workspace CLI (`@googleworkspace/cli`). Provides access to Google Workspace APIs (Drive, Calendar, Gmail, etc.).

```bash
# List Drive files
gws drive files list --format json

# Get calendar events
gws calendar events list --calendarId primary --format json
```

Requires: `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` environment variable pointing to an `authorized_user` credentials JSON file.

### sprite

Sprite CLI for inter-sprite communication on Fly.io.

```bash
# List available sprites
sprite list

# Send a message to another sprite
sprite send <sprite-name> "message"
```

Requires: Either `SPRITE_TOKEN` environment variable or `~/.sprites/sprites.json` config file.

### gam

GAMADV-XTD3 CLI for Google Admin SDK (user, group, and device management).

```bash
# Get domain info
gam info domain

# List users
gam print users

# Get user info
gam info user user@example.com
```

Requires: `GAMCFGDIR` environment variable pointing to a directory with `oauth2service.json`, `oauth2.txt`, and `client_secrets.json`.

## Checking Tool Availability

```bash
command -v nori-slack && echo "available" || echo "not available"
command -v gws && echo "available" || echo "not available"
command -v sprite && echo "available" || echo "not available"
command -v gam && echo "available" || echo "not available"
```

Tools that failed setup are omitted from `~/AGENTS.md`.

The `nori-broker` CLI is also available on every sprite, but it is not part of this toolshed -- it ships through the broker server's base bootstrap bundle (canonical source: `sessions/broker/cli/` in the `tilework-tech/sessions` repo). Refer to its own documentation for usage.
