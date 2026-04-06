# Noridoc: nori-integrations

Path: @/

### Overview
- Monorepo containing integration packages that connect Nori agents to third-party services
- Each subdirectory is a standalone integration package targeting a specific service (Slack, Google Workspace, etc.)

### How it fits into the larger codebase
- Integration packages are consumed by the broker (nori-handroll), which installs binaries via bootstrap, injects credentials via config-builder, and runs setup/verification scripts during sprite provisioning
- Each integration follows a common pattern: provide an agent-friendly CLI interface with JSON output, and a setup mechanism to verify prerequisites

### Core Implementation
- [`setup.sh`](setup.sh) -- Unified entry point that bootstraps all integration packages in sequence and generates `~/AGENTS.md`. Delegates to each sub-package's own setup mechanism rather than duplicating logic: `npm install && npm run build` for nori-slack-cli, `setup.sh` for nori-gws, nori-sprites, and nori-gam
- `~/AGENTS.md` -- Generated (not hand-maintained) discovery file that lists all available CLIs and the source repo path, so any coding agent can discover what tools are available
- [@/nori-slack-cli](nori-slack-cli/) -- TypeScript CLI wrapping `@slack/web-api` for Slack Web API access; a custom wrapper because no suitable agent-friendly CLI existed
- [@/nori-gws](nori-gws/) -- Setup/configuration package for the `gws` CLI (`@googleworkspace/cli`) for Google Workspace API access; uses the existing `gws` binary directly rather than wrapping it, since `gws` already provides agent-friendly features (JSON output, `--dry-run`, discovery-based command surface)
- [@/nori-sprites](nori-sprites/) -- Setup/verification package for the `sprite` CLI for inter-sprite communication on Fly.io; follows the same shell-script-only pattern as nori-gws since the `sprite` CLI is already agent-friendly
- [@/nori-gam](nori-gam/) -- Setup/verification package for the `gam` CLI (GAMADV-XTD3) for Google Admin SDK access (user/group/device management); shell-script-only pattern with auto-installation capability

### Things to Know
- Integrations follow two architectural patterns based on whether a suitable agent-friendly CLI already exists: nori-slack-cli is a full TypeScript CLI project, while nori-gws, nori-sprites, and nori-gam are shell-script-only setup/verification layers around existing CLIs
- `setup.sh` uses partial-failure tolerance: each sub-package setup runs inside an `if` block that captures success/failure, so one package failing does not prevent the others from being attempted. `~/AGENTS.md` is always written but only lists successfully set up CLIs. Exit code is 0 if all packages succeed, 1 if any failed. A summary table (OK/FAIL per package) is printed to stderr at the end
- `~/AGENTS.md` is overwritten on every run, making `setup.sh` idempotent
- Git worktrees are used for parallel development on different integrations (e.g., `slack` worktree, `googleworkspace` worktree)

Created and maintained by Nori.
