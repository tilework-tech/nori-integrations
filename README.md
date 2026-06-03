# nori-integrations

A toolshed of agent-friendly CLI integrations that connect coding agents to third-party services (Google Admin, AWS SES, and more).

Each package in this monorepo is a setup/verification layer around an existing agent-friendly CLI. All of them output JSON to stdout, send human messages to stderr, authenticate via environment variables, and avoid interactive prompts — so agents can call them reliably.

## Integrations

| CLI           | Description                                                          |
|---------------|----------------------------------------------------------------------|
| `gam`         | Google Admin (GAMADV-XTD3) — user/group/device management            |
| `sprite`      | Inter-sprite communication on Fly.io                                 |
| `nori-newsletter` | Newsletter management via AWS SES — contacts, sends, CSV import  |

Each subdirectory has a `CAPABILITIES.md` listing what the tool can do and a `docs.md` with architecture and setup details.

## Setup

```bash
./setup.sh
export PATH="$PWD/bin:$PATH"
```

`setup.sh` verifies each integration's prerequisites and writes `~/AGENTS.md` listing every successfully-set-up CLI with its capabilities. Partial failures are tolerated: if one package fails, the rest still set up and `~/AGENTS.md` reflects only what succeeded.

## Usage modes

**Standalone** — run `setup.sh` on your machine and call the CLIs directly. `~/AGENTS.md` is the discovery file that agents (Claude Code, etc.) read to learn what's available.

**Toolshed** — a broker clones this repo onto a sprite, runs `setup.sh`, adds `bin/` to `$PATH`, and symlinks `skills/` into `~/.claude/skills/toolshed/`. The `nori-integrations-toolshed` skill in that directory describes each CLI in detail.

## License

Apache 2.0 — see [LICENSE](LICENSE) and [LICENSE-ADDENDUM.txt](LICENSE-ADDENDUM.txt) (Ship of Theseus addendum covering AI-assisted derivatives).
