---
name: nori-integrations-toolshed
description: Documents the CLI tools available in the nori-integrations toolshed and how to use them.
---

# nori-integrations Toolshed

This toolshed provides CLI tools for interacting with third-party services.

## Available Tools

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
command -v sprite && echo "available" || echo "not available"
command -v gam && echo "available" || echo "not available"
```

Tools that failed setup are omitted from `~/AGENTS.md`.

The `nori-broker` and `nori-slack` CLIs are also available on every sprite, but they are not part of this toolshed -- they ship through the broker server's base bootstrap bundle. Refer to their own documentation for usage.
