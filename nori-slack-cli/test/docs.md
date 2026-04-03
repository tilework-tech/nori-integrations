# Noridoc: nori-slack-cli/test

Path: @/nori-slack-cli/test

### Overview
- Unit tests for `parseArgs`, `formatError`, and `mergePages`, plus integration tests that invoke the CLI as a subprocess
- Uses Vitest as the test runner; integration tests use `tsx` to run the TypeScript source directly (no build step needed)

### How it fits into the larger codebase
- Tests cover the pure utility modules in [@/nori-slack-cli/src](../src/): argument parsing, error formatting, and pagination merging
- Integration tests in [cli.test.ts](cli.test.ts) exercise the full CLI binary by spawning `npx tsx src/index.ts` as a child process, verifying end-to-end behavior including exit codes, stdout JSON structure, and stderr output
- The test directory is excluded from TypeScript compilation via `tsconfig.json`

### Core Implementation

**`parse-args.test.ts`** -- Tests the argument parser in isolation:
- Verifies `--key value` pairs, `--key=value` syntax, and standalone boolean flags
- Confirms kebab-to-snake conversion (`--unfurl-links` becomes `unfurl_links`)
- Validates type coercion: booleans, numbers, JSON arrays/objects, and preservation of leading-zero strings

**`errors.test.ts`** -- Tests error formatting for each Slack error category:
- Platform errors (e.g., `channel_not_found`) produce suggestions referencing relevant API methods
- Rate limit errors include retry timing
- Network errors surface the underlying error message
- Missing token errors suggest setting `SLACK_BOT_TOKEN`

**`paginate.test.ts`** -- Unit tests for the `mergePages` function:
- Uses a `toAsyncIterable` helper to create async iterables from arrays of page objects
- Verifies array concatenation across pages, preservation of metadata from the last page, handling of empty arrays and single pages

**`cli.test.ts`** -- Integration tests that run the CLI as a subprocess:
- `runCli` helper spawns the CLI with `execFile` and captures stdout/stderr/exit code
- `runCliWithStdin` helper uses `spawn` with piped stdin for `--json-input` tests
- Tests use fake tokens (`xoxb-fake-token`) which produce real Slack `invalid_auth` errors, proving the full request path works without needing a valid token
- Validates: no-args usage error, missing token error, `list-methods` output, structured JSON for API failures, stdin JSON input, source path in errors, suggestion text presence, and `--paginate` flag acceptance

### Things to Know
- Integration tests make real HTTP calls to Slack's API (with invalid tokens), so they require network access
- The `runCli` helper sets a 10-second timeout to prevent hangs
- Tests intentionally verify structure (JSON shape, field presence, field types) rather than exact string values, making them resilient to Slack API message changes

Created and maintained by Nori.
