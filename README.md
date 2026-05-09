# nori-integrations

A toolshed of agent-friendly CLI integrations that connect coding agents to third-party services (Slack, Google Workspace, AWS, and more).

Each package in this monorepo is either a thin TypeScript CLI wrapping a service's SDK (when no agent-friendly CLI exists) or a setup/verification layer around an existing CLI. All of them output JSON to stdout, send human messages to stderr, authenticate via environment variables, and avoid interactive prompts — so agents can call them reliably.

## Integrations

| CLI           | Description                                                          |
|---------------|----------------------------------------------------------------------|
| `nori-slack`  | Slack Web API — call any method dynamically                          |
| `gws`         | Google Workspace — Drive, Gmail, Calendar, Sheets, Docs              |
| `gam`         | Google Admin (GAMADV-XTD3) — user/group/device management            |
| `aws`         | AWS CLI v2 — EC2, S3, CloudFront, Route 53, IAM, and other services  |
| `sprite`      | Inter-sprite communication on Fly.io                                 |

Each subdirectory has a `CAPABILITIES.md` listing what the tool can do and a `docs.md` with architecture and setup details.

## Setup

```bash
./setup.sh
export PATH="$PWD/bin:$PATH"
```

`setup.sh` builds each package, symlinks executables into `bin/`, and writes `~/AGENTS.md` listing every successfully-set-up CLI with its capabilities. Partial failures are tolerated: if one package fails, the rest still install and `~/AGENTS.md` reflects only what succeeded.

## Usage modes

**Standalone** — run `setup.sh` on your machine and call the CLIs directly. `~/AGENTS.md` is the discovery file that agents (Claude Code, etc.) read to learn what's available.

**Toolshed** — a broker clones this repo onto a sprite, runs `setup.sh`, adds `bin/` to `$PATH`, and symlinks `skills/` into `~/.claude/skills/toolshed/`. The `nori-integrations-toolshed` skill in that directory describes each CLI in detail.

## License

Apache 2.0 — see [LICENSE](LICENSE) and [LICENSE-ADDENDUM.txt](LICENSE-ADDENDUM.txt) (Ship of Theseus addendum covering AI-assisted derivatives).
