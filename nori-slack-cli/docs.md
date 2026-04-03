# Noridoc: nori-slack-cli

Path: @/nori-slack-cli

### Overview
- A TypeScript CLI that exposes the entire Slack Web API as a single command: `nori-slack <method> [--param value ...]`
- Designed for coding agents: all output is JSON on stdout, human-readable errors go to stderr
- Uses `@slack/web-api` WebClient's `apiCall()` method for dynamic dispatch -- the CLI is not limited to a fixed set of methods

### How it fits into the larger codebase
- Lives as a standalone tool under the `nori-integrations` monorepo, in the `slack` worktree
- Intended to be `npm link`ed or installed globally so agents can invoke `nori-slack` from any working directory
- Authentication is bot-token-only via `SLACK_BOT_TOKEN` environment variable (no user OAuth flows)
- The CLI is a thin wrapper -- it does not contain business logic, scheduling, or state management; it translates CLI flags into Slack API calls and returns the raw JSON response

### Core Implementation
- Entry point is [src/index.ts](src/index.ts), which uses Commander.js with `allowUnknownOption()` so arbitrary `--flag value` pairs pass through without Commander rejecting them
- The single dynamic command accepts a method name positional arg, collects all remaining flags, and calls `WebClient.apiCall(method, params)`
- Two input modes: CLI flags (`--channel C123 --text "hi"`) and piped JSON via `--json-input`; when both are provided, CLI flags override stdin values
- `list-methods` is a separate subcommand that dumps the known methods list as JSON -- but the CLI accepts any method string, not just known ones
- Successful API responses and error responses both go to stdout as JSON; errors additionally write a human-readable line to stderr
- Exit codes: `0` for success, `1` for API/token errors, `2` for missing args or invalid stdin JSON

### Things to Know
- Flag parsing in [src/parse-args.ts](src/parse-args.ts) converts `--kebab-case` to `snake_case` because the Slack API uses snake_case parameter names
- Type coercion in `coerceValue` handles booleans (`"true"`/`"false"`), numbers (but preserves leading-zero strings like `"007"`), and inline JSON arrays/objects
- A standalone `--flag` with no following value (or followed by another `--flag`) is treated as boolean `true`
- Error formatting in [src/errors.ts](src/errors.ts) maps Slack error codes to actionable suggestions (e.g., `channel_not_found` suggests running `conversations.list`); unknown errors get a generic suggestion pointing to the source directory
- Every error response includes a `source` field with the filesystem path to the CLI, so agents can locate the source code for debugging
- The `postbuild` script runs `chmod +x` on the output and `npm link` to make the binary available immediately after build

Created and maintained by Nori.
