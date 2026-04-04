# Noridoc: nori-integrations

Path: @/

### Overview
- Monorepo containing integration packages that connect Nori agents to third-party services
- Each subdirectory is a standalone integration package targeting a specific service (Slack, Google Workspace, etc.)

### How it fits into the larger codebase
- Integration packages are consumed by the broker (nori-handroll), which installs binaries via bootstrap, injects credentials via config-builder, and runs setup/verification scripts during sprite provisioning
- Each integration follows a common pattern: provide an agent-friendly CLI interface with JSON output, and a setup mechanism to verify prerequisites

### Core Implementation
- [@/nori-slack-cli](nori-slack-cli/) -- TypeScript CLI wrapping `@slack/web-api` for Slack Web API access; a custom wrapper because no suitable agent-friendly CLI existed
- [@/nori-gws](nori-gws/) -- Setup/configuration package for the `gws` CLI (`@googleworkspace/cli`) for Google Workspace API access; uses the existing `gws` binary directly rather than wrapping it, since `gws` already provides agent-friendly features (JSON output, `--dry-run`, discovery-based command surface)
- [@/nori-sprites](nori-sprites/) -- Setup/verification package for the `sprite` CLI for inter-sprite communication on Fly.io; follows the same shell-script-only pattern as nori-gws since the `sprite` CLI is already agent-friendly

### Things to Know
- Integrations follow two architectural patterns based on whether a suitable agent-friendly CLI already exists: nori-slack-cli is a full TypeScript CLI project, while nori-gws and nori-sprites are shell-script-only setup/verification layers around existing CLIs
- Git worktrees are used for parallel development on different integrations (e.g., `slack` worktree, `googleworkspace` worktree)

Created and maintained by Nori.
