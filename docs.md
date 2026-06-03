# Noridoc: nori-integrations

Path: @/

### Overview
- Monorepo of org-specific third-party integration CLIs (Google Workspace, Google Admin, Fly.io sprites, newsletter) that connect Nori agents to external services
- Each subdirectory is a standalone shell-script setup/verification layer around an existing agent-friendly CLI
- Conforms to the **toolshed contract**: the broker clones this repo to `~/toolshed/` on sprites, adds `bin/` to `$PATH`, and symlinks [@/skills](skills/) into `~/.claude/skills/toolshed/`

### How it fits into the larger codebase
- Integration packages are consumed by the broker, which clones this repo as a toolshed, runs [setup.sh](setup.sh), and makes the resulting `bin/` directory available on `$PATH`
- The broker also symlinks [@/skills](skills/) into `~/.claude/skills/toolshed/` so agents on sprites automatically discover the toolshed skill describing available CLIs
- Each integration follows a single architectural pattern: a shell-script setup/verification layer that validates prerequisites (binary on PATH, credentials configured) for an existing agent-friendly CLI. No integrations in this repo build or compile anything
- [setup.sh](setup.sh) no longer calls `npm` -- it only delegates to each sub-package's own `setup.sh` script
- The `nori-broker` and `nori-slack` CLIs are intentionally NOT part of this toolshed: they are product-guaranteed CLIs delivered through the broker server's base bootstrap bundle (canonical sources in the `tilework-tech/sessions` and `tilework-tech/nori-slack-cli` repos respectively, installed on every sprite regardless of which toolshed an org configures)

### Core Implementation
- [setup.sh](setup.sh) -- Unified entry point that bootstraps every integration package in sequence and generates `~/AGENTS.md`. Delegates to each sub-package's own `setup.sh` for the actual validation work ([@/nori-gws](nori-gws/), [@/nori-sprites](nori-sprites/), [@/nori-gam](nori-gam/), [@/nori-newsletter-cli](nori-newsletter-cli/)). Uses the `emit_tool()` helper to format each tool's entry in `~/AGENTS.md`, pulling from `CAPABILITIES.md` when available or falling back to a one-liner description
- `CAPABILITIES.md` -- Convention for tool discoverability. Each tool directory can contain a `CAPABILITIES.md` file (static, human-authored) that describes the tool's high-level capabilities in under 300 tokens. The first line becomes the tool header in `~/AGENTS.md`; subsequent non-empty lines are indented beneath it. When absent, the tool falls back to a flat one-liner entry
- `bin/` -- Generated directory (gitignored) created by [setup.sh](setup.sh). Currently no integrations produce symlinks into this directory since all integrations use system-level CLIs directly, but the directory is still created for forward compatibility with the toolshed contract
- `~/AGENTS.md` -- Generated (not hand-maintained) discovery file that lists all available CLIs with their capabilities and references the toolshed skill for detailed usage
- [@/skills](skills/) -- Shared agent skills directory. Contains skill files that the broker symlinks into `~/.claude/skills/toolshed/` on sprites. Distinct from `.claude/skills/` which are for working on this repo itself
- [@/nori-gws](nori-gws/) -- Setup/configuration package for the `gws` CLI (`@googleworkspace/cli`) for Google Workspace API access
- [@/nori-sprites](nori-sprites/) -- Setup/verification package for the `sprite` CLI for inter-sprite communication on Fly.io
- [@/nori-gam](nori-gam/) -- Setup/verification package for the `gam` CLI (GAMADV-XTD3) for Google Admin SDK access (user/group/device management)
- [@/nori-newsletter-cli](nori-newsletter-cli/) -- Setup/verification package for the `nori-newsletter` CLI for newsletter management via AWS SES (contact lists, email sending, CSV import, rate throttling); npm-based installation and JSON config file validation

### Things to Know
- [setup.sh](setup.sh) uses partial-failure tolerance: each sub-package setup runs inside an `if` block that captures success/failure, so one package failing does not prevent the others from being attempted. `~/AGENTS.md` is always written but only lists successfully set up CLIs -- and only includes capability details for those that succeeded, even if the failed tool has a `CAPABILITIES.md`. Exit code is 0 if all packages succeed, 1 if any failed. A summary table (OK/FAIL per package) is printed to stderr at the end
- `~/AGENTS.md` is overwritten on every run, making [setup.sh](setup.sh) idempotent
- `CAPABILITIES.md` files are optional and the system degrades gracefully: missing or empty files trigger the one-liner fallback in `emit_tool()`. The `emit_tool()` helper strips blank lines from capabilities content and indents each line with two spaces for nested markdown list rendering
- The repo serves dual purposes: standalone usage (run `setup.sh` directly) and toolshed usage (configured via `toolshedRepoUrl` in fleet settings, cloned and set up by the broker)
- Two distinct `skills/` directories exist: [@/skills](skills/) is shared to all sprites via the toolshed mechanism, while `.claude/skills/` contains skills for developing on this repo

Created and maintained by Nori.
