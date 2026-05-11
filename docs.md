# Noridoc: nori-integrations

Path: @/

### Overview
- Monorepo of org-specific third-party integration CLIs (Slack, Google Workspace, Google Admin, AWS, Fly.io sprites) that connect Nori agents to external services
- Each subdirectory is a standalone integration package targeting a specific service
- Conforms to the **toolshed contract**: the broker clones this repo to `~/toolshed/` on sprites, adds `bin/` to `$PATH`, and symlinks [@/skills](skills/) into `~/.claude/skills/toolshed/`

### How it fits into the larger codebase
- Integration packages are consumed by the broker, which clones this repo as a toolshed, runs [setup.sh](setup.sh), and makes the resulting `bin/` directory available on `$PATH`
- The broker also symlinks [@/skills](skills/) into `~/.claude/skills/toolshed/` so agents on sprites automatically discover the toolshed skill describing available CLIs
- The `nori-broker` CLI is intentionally NOT part of this toolshed: it is a product-guaranteed CLI delivered through the broker server's base bootstrap bundle (canonical source: `sessions/broker/cli/` in the `tilework-tech/sessions` repo, installed at `~/.local/bin/nori-broker` on every sprite regardless of which toolshed an org configures)
- Each integration follows a common pattern: provide an agent-friendly CLI interface with JSON output, and a setup mechanism to verify prerequisites

### Core Implementation
- [setup.sh](setup.sh) -- Unified entry point that bootstraps every integration package in sequence, creates `bin/` with executable symlinks, and generates `~/AGENTS.md`. Delegates to each sub-package's own setup mechanism rather than duplicating logic: `npm install && npm run build` for [@/nori-slack-cli](nori-slack-cli/), and a package-local `setup.sh` for the shell-based integrations ([@/nori-gws](nori-gws/), [@/nori-sprites](nori-sprites/), [@/nori-gam](nori-gam/), [@/nori-aws-cli](nori-aws-cli/)). Uses the `emit_tool()` helper to format each tool's entry in `~/AGENTS.md`, pulling from `CAPABILITIES.md` when available or falling back to a one-liner description
- `CAPABILITIES.md` -- Convention for tool discoverability. Each tool directory can contain a `CAPABILITIES.md` file (static, human-authored) that describes the tool's high-level capabilities in under 300 tokens. The first line becomes the tool header in `~/AGENTS.md`; subsequent non-empty lines are indented beneath it. When absent, the tool falls back to a flat one-liner entry
- `bin/` -- Generated directory (gitignored) containing symlinks to built executables (e.g., `bin/nori-slack -> ../nori-slack-cli/dist/index.js`). When used as a toolshed, the broker adds this directory to `$PATH` so executables are directly callable
- `~/AGENTS.md` -- Generated (not hand-maintained) discovery file that lists all available CLIs with their capabilities and references the toolshed skill for detailed usage
- [@/skills](skills/) -- Shared agent skills directory. Contains skill files that the broker symlinks into `~/.claude/skills/toolshed/` on sprites. Distinct from `.claude/skills/` which are for working on this repo itself
- Integration packages: [@/nori-slack-cli](nori-slack-cli/) (TypeScript wrapper around `@slack/web-api`); [@/nori-gws](nori-gws/), [@/nori-sprites](nori-sprites/), [@/nori-gam](nori-gam/), and [@/nori-aws-cli](nori-aws-cli/) (shell-script setup/verification layers around already-agent-friendly third-party CLIs)

### Things to Know
- Integrations follow two architectural patterns based on whether a suitable agent-friendly CLI already exists: TypeScript CLI projects (currently just [@/nori-slack-cli](nori-slack-cli/)) when no upstream CLI fits, and shell-script-only setup/verification layers around existing CLIs ([@/nori-gws](nori-gws/), [@/nori-sprites](nori-sprites/), [@/nori-gam](nori-gam/), [@/nori-aws-cli](nori-aws-cli/))
- [setup.sh](setup.sh) uses partial-failure tolerance: each sub-package setup runs inside an `if` block that captures success/failure, so one package failing does not prevent the others from being attempted. `~/AGENTS.md` is always written but only lists successfully set up CLIs -- and only includes capability details for those that succeeded, even if the failed tool has a `CAPABILITIES.md`. Exit code is 0 if all packages succeed, 1 if any failed. A summary table (OK/FAIL per package) is printed to stderr at the end
- `~/AGENTS.md` is overwritten on every run, making [setup.sh](setup.sh) idempotent
- `CAPABILITIES.md` files are optional and the system degrades gracefully: missing or empty files trigger the one-liner fallback in `emit_tool()`. The `emit_tool()` helper strips blank lines from capabilities content and indents each line with two spaces for nested markdown list rendering
- [setup.sh](setup.sh) removes stale `bin/` symlinks before attempting each build, so a previously-successful binary does not persist after a failed rebuild
- The repo serves dual purposes: standalone usage (run `setup.sh` directly) and toolshed usage (configured via `toolshedRepoUrl` in fleet settings, cloned and set up by the broker)
- Two distinct `skills/` directories exist: [@/skills](skills/) is shared to all sprites via the toolshed mechanism, while `.claude/skills/` contains skills for developing on this repo
- The broker CLI used to live here as `nori-broker-cli/` but was removed because it duplicated the canonical implementation in the broker server's bootstrap bundle; orgs whose toolshed is `nori-integrations` previously had the stale toolshed copy shadowed onto `$PATH` ahead of the canonical bundled binary

Created and maintained by Nori.
