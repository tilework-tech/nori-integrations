# Noridoc: nori-integrations

Path: @/

### Overview
- Monorepo containing integration packages that connect Nori agents to third-party services
- Each subdirectory is a standalone integration package targeting a specific service (Slack, Google Workspace, etc.)
- Conforms to the **toolshed contract**: the broker (nori-handroll) clones this repo to `~/toolshed/` on sprites, adds `bin/` to `$PATH`, and symlinks `skills/` into `~/.claude/skills/toolshed/`

### How it fits into the larger codebase
- Integration packages are consumed by the broker (nori-handroll), which clones this repo as a toolshed, runs `setup.sh`, and makes the resulting `bin/` directory available on `$PATH`
- The broker also symlinks [@/skills](skills/) into `~/.claude/skills/toolshed/` so agents on sprites automatically discover the toolshed skill describing available CLIs
- Each integration follows a common pattern: provide an agent-friendly CLI interface with JSON output, and a setup mechanism to verify prerequisites

### Core Implementation
- [`setup.sh`](setup.sh) -- Unified entry point that bootstraps all integration packages in sequence, creates `bin/` with executable symlinks, and generates `~/AGENTS.md`. Delegates to each sub-package's own setup mechanism rather than duplicating logic: `npm install && npm run build` for nori-slack-cli and nori-broker-cli, `setup.sh` for nori-gws, nori-sprites, nori-gam, and nori-aws-cli. Uses the `emit_tool()` helper to format each tool's entry in `~/AGENTS.md`, pulling from `CAPABILITIES.md` when available or falling back to a one-liner description
- `CAPABILITIES.md` -- Convention for tool discoverability. Each tool directory can contain a `CAPABILITIES.md` file (static, human-authored) that describes the tool's high-level capabilities in under 300 tokens. The first line becomes the tool header in `~/AGENTS.md`; subsequent non-empty lines are indented beneath it. When absent, the tool falls back to a flat one-liner entry
- `bin/` -- Generated directory (gitignored) containing symlinks to built executables (e.g., `bin/nori-slack -> ../nori-slack-cli/dist/index.js`, `bin/nori-broker -> ../nori-broker-cli/dist/index.js`). When used as a toolshed, the broker adds this directory to `$PATH` so executables are directly callable
- `~/AGENTS.md` -- Generated (not hand-maintained) discovery file that lists all available CLIs with their capabilities and references the toolshed skill for detailed usage. Format changed from flat one-liners to multi-line entries when a tool has a `CAPABILITIES.md`
- [@/skills](skills/) -- Shared agent skills directory. Contains skill files that the broker symlinks into `~/.claude/skills/toolshed/` on sprites. Distinct from `.claude/skills/` which are for working on this repo itself
- [@/nori-slack-cli](nori-slack-cli/) -- TypeScript CLI wrapping `@slack/web-api` for Slack Web API access; a custom wrapper because no suitable agent-friendly CLI existed
- [@/nori-broker-cli](nori-broker-cli/) -- TypeScript CLI wrapping the nori broker HTTP API; maps 1:1 to authenticated broker endpoints for session management, fleet configuration, integrations, triggers, notifications, scripts, and stats. Follows the same build pattern as nori-slack-cli
- [@/nori-gws](nori-gws/) -- Setup/configuration package for the `gws` CLI (`@googleworkspace/cli`) for Google Workspace API access; uses the existing `gws` binary directly rather than wrapping it, since `gws` already provides agent-friendly features (JSON output, `--dry-run`, discovery-based command surface)
- [@/nori-sprites](nori-sprites/) -- Setup/verification package for the `sprite` CLI for inter-sprite communication on Fly.io; follows the same shell-script-only pattern as nori-gws since the `sprite` CLI is already agent-friendly
- [@/nori-gam](nori-gam/) -- Setup/verification package for the `gam` CLI (GAMADV-XTD3) for Google Admin SDK access (user/group/device management); shell-script-only pattern with auto-installation capability
- [@/nori-aws-cli](nori-aws-cli/) -- Setup/verification package for the AWS CLI v2 for AWS API access (EC2, S3, CloudFront, Route 53, Secrets Manager, CloudFormation); shell-script-only pattern with auto-installation capability and three credential detection methods (env vars, credentials file, named profiles)

### Things to Know
- Integrations follow two architectural patterns based on whether a suitable agent-friendly CLI already exists: nori-slack-cli and nori-broker-cli are full TypeScript CLI projects, while nori-gws, nori-sprites, nori-gam, and nori-aws-cli are shell-script-only setup/verification layers around existing CLIs
- `setup.sh` uses partial-failure tolerance: each sub-package setup runs inside an `if` block that captures success/failure, so one package failing does not prevent the others from being attempted. `~/AGENTS.md` is always written but only lists successfully set up CLIs — and only includes capability details for those that succeeded, even if the failed tool has a `CAPABILITIES.md`. Exit code is 0 if all packages succeed, 1 if any failed. A summary table (OK/FAIL per package) is printed to stderr at the end
- `~/AGENTS.md` is overwritten on every run, making `setup.sh` idempotent
- `CAPABILITIES.md` files are optional and the system degrades gracefully: missing or empty files trigger the one-liner fallback in `emit_tool()`. The `emit_tool()` helper strips blank lines from capabilities content and indents each line with two spaces for nested markdown list rendering
- `setup.sh` removes stale `bin/` symlinks before attempting each build, so a previously-successful binary does not persist after a failed rebuild
- The repo serves dual purposes: standalone usage (run `setup.sh` directly) and toolshed usage (configured via `toolshedRepoUrl` in fleet settings, cloned and set up by the broker)
- Two distinct `skills/` directories exist: [@/skills](skills/) is shared to all sprites via the toolshed mechanism, while `.claude/skills/` contains skills for developing on this repo
- Git worktrees are used for parallel development on different integrations (e.g., `slack` worktree, `googleworkspace` worktree)

Created and maintained by Nori.
