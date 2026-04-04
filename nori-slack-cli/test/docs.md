# Noridoc: nori-slack-cli/test

Path: @/nori-slack-cli/test

### Overview
- Unit tests for `parseArgs`, `formatError`, `mergePages`, and method metadata coverage, plus integration tests that invoke the CLI as a subprocess
- Uses Vitest as the test runner; integration tests in `cli.test.ts` use `tsx` to run TypeScript source directly, while `build.test.ts` compiles via `tsc` and runs the built `dist/index.js` artifact

### How it fits into the larger codebase
- Tests cover the pure utility modules in [@/nori-slack-cli/src](../src/): argument parsing, error formatting, pagination merging, and method metadata
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

**`method-metadata.test.ts`** -- Coverage guard for method metadata:
- Asserts that `getMethodMetadata` returns a curated (non-fallback) description for every method in `KNOWN_METHODS`, ensuring new methods added to the catalog also get metadata entries

**`cli.test.ts`** -- Integration tests that run the CLI as a subprocess:
- `runCli` helper spawns the CLI with `execFile` and captures stdout/stderr/exit code
- `runCliWithStdin` helper uses `spawn` with piped stdin for `--json-input` tests
- Tests use fake tokens (`xoxb-fake-token`) which produce real Slack `invalid_auth` errors, proving the full request path works without needing a valid token
- Validates: no-args usage error, missing token error, `list-methods` output, structured JSON for API failures, stdin JSON input, source path in errors, suggestion text presence, `--paginate` flag acceptance, `--dry-run` behavior, `describe` command behavior, and `list-methods` filtering/description options
- Describe tests cover: known method metadata output (required/optional params, docs URL), fallback for unknown methods (`known: false`), pagination support flags, deprecation notices, missing argument error, and spot-checks across newly-added namespaces (e.g., `dnd.setSnooze`, `usergroups.create`, `views.open`, `team.info`)
- `list-methods` tests cover: `--namespace` filtering (verifies all returned methods share the prefix and unrelated methods are excluded), empty namespace returning an empty array, `--descriptions` changing the output shape to objects with `method` and `description` fields, and composition of both flags together
- Suggestion tests cover: dry-run with misspelled methods verifying `suggestions` array and `warning` field in JSON output, case-correction suggestions, and stderr "Did you mean" warnings before API calls

**`suggest.test.ts`** -- Unit tests for the `findSimilarMethods` function:
- Verifies exact matches return no suggestions, case-insensitive matches return the correctly-cased method, single-character typos find the right method, nonsense input returns empty, result count respects the `maxResults` parameter, and results are sorted by similarity (closest first)

**`build.test.ts`** -- Build verification tests that exercise the compiled output:
- `beforeAll` runs `tsc` once; all tests share the resulting `dist/index.js`
- Uses `node dist/index.js` directly (unlike `cli.test.ts` which uses `npx tsx src/index.ts`), verifying the actual build artifact that `npm link` would expose
- Validates `--version` output, `list-methods` JSON structure, and no-args usage error exit code

### Things to Know
- Integration tests make real HTTP calls to Slack's API (with invalid tokens), so they require network access
- The `runCli` helper sets a 10-second timeout to prevent hangs
- Tests intentionally verify structure (JSON shape, field presence, field types) rather than exact string values, making them resilient to Slack API message changes

Created and maintained by Nori.
