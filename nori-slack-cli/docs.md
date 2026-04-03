# Noridoc: nori-slack-cli

Path: @/nori-slack-cli

### Overview
- A TypeScript CLI that exposes the entire Slack Web API as a single command: `nori-slack <method> [--param value ...]`
- Designed for coding agents: all output is JSON on stdout, human-readable errors go to stderr
- Uses `@slack/web-api` WebClient for dynamic dispatch -- the CLI is not limited to a fixed set of methods
- Supports automatic cursor pagination via `--paginate`, which fetches all pages and returns a single merged JSON response
- Supports `--dry-run` to preview resolved API requests without sending them -- designed as a safety net for coding agents to validate parameter resolution
- Supports `describe <method>` to look up parameter documentation for any Slack API method without requiring a token -- the metadata map covers all methods in `KNOWN_METHODS`, so agents always get full parameter documentation rather than a fallback

### How it fits into the larger codebase
- Lives as a standalone tool under the `nori-integrations` monorepo, in the `slack` worktree
- Intended to be `npm link`ed or installed globally so agents can invoke `nori-slack` from any working directory
- Authentication is bot-token-only via `SLACK_BOT_TOKEN` environment variable (no user OAuth flows)
- The CLI is a thin wrapper -- it does not contain business logic, scheduling, or state management; it translates CLI flags into Slack API calls and returns the raw JSON response
- The project spec lives in [spec/APPLICATION-SPEC.md](spec/APPLICATION-SPEC.md)
- The pagination merge logic in [src/paginate.ts](src/paginate.ts) is a pure function decoupled from the Slack SDK -- it operates on any `AsyncIterable` of page objects

### Core Implementation
- Entry point is [src/index.ts](src/index.ts), which uses Commander.js with `allowUnknownOption()` so arbitrary `--flag value` pairs pass through without Commander rejecting them
- The dynamic handler has three code paths: `--dry-run` short-circuits after param resolution (no token required, no API call), `--paginate` triggers `WebClient.paginate()` + `mergePages()`, and the default path uses `WebClient.apiCall()`
- Two input modes: CLI flags (`--channel C123 --text "hi"`) and piped JSON via `--json-input`; when both are provided, CLI flags override stdin values
- Two discovery subcommands that do not require `SLACK_BOT_TOKEN`: `list-methods` outputs known method names as JSON (supports `--namespace` filtering and `--descriptions` to include method descriptions), and `describe <method>` returns structured parameter documentation (required params, optional params, pagination support, deprecation notices, and docs URL)
- `describe` uses [src/method-metadata.ts](src/method-metadata.ts), a hand-curated static map covering every method in `KNOWN_METHODS` -- this is static because `@slack/web-api` erases parameter type information at compile time, so runtime introspection is not possible
- For unknown methods (not in `KNOWN_METHODS`), `getMethodMetadata()` returns a fallback entry with empty params and a generated docs URL, so `describe` never errors; the `known` field in the output distinguishes curated entries from fallbacks
- When an unknown method is used, [src/suggest.ts](src/suggest.ts) provides fuzzy matching via Levenshtein distance against `KNOWN_METHODS`, surfacing up to 3 "Did you mean?" suggestions in both `--dry-run` JSON output and stderr warnings before API calls; suggestions are non-blocking -- unknown methods still proceed to the API
- Successful API responses and error responses both go to stdout as JSON; errors additionally write a human-readable line to stderr
- Exit codes: `0` for success, `1` for API/token errors, `2` for missing args or invalid stdin JSON

### Things to Know
- Flag parsing in [src/parse-args.ts](src/parse-args.ts) converts `--kebab-case` to `snake_case` because the Slack API uses snake_case parameter names
- Type coercion in `coerceValue` handles booleans (`"true"`/`"false"`), numbers (but preserves leading-zero strings like `"007"`), and inline JSON arrays/objects
- A standalone `--flag` with no following value (or followed by another `--flag`) is treated as boolean `true`
- Error formatting in [src/errors.ts](src/errors.ts) maps Slack error codes to actionable suggestions (e.g., `channel_not_found` suggests running `conversations.list`); unknown errors get a generic suggestion pointing to the source directory
- Every error response includes a `source` field with the filesystem path to the CLI, so agents can locate the source code for debugging
- The method metadata in [src/method-metadata.ts](src/method-metadata.ts) marks `files.upload` as deprecated with a pointer to the two-step `files.getUploadURLExternal` + `files.completeUploadExternal` flow
- The `postbuild` script runs `chmod +x` on the output and `npm link` to make the binary available immediately after build

Created and maintained by Nori.
