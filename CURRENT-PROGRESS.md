# Current Progress

## Status: Dry-Run Support + Spec Relocation

The nori-slack-cli project has core CLI infrastructure, automatic pagination, and dry-run preview, with 32 passing tests.

## Completed

### Commit 1: Initial project spec and claude configuration
- APPLICATION-SPEC.md and .claude/ configuration committed

### Commit 2: Core CLI infrastructure
- **Project scaffolding**: TypeScript project with commander, @slack/web-api, vitest
- **Dynamic method dispatch**: Any Slack Web API method callable via `nori-slack <method> [--params...]`
- **Argument parsing**: `--kebab-case` flags auto-converted to `snake_case`, type coercion (booleans, numbers, JSON)
- **Error formatting**: Structured JSON errors with Slack-specific suggestions and source path
- **Stdin JSON input**: `--json-input` flag reads complex params from stdin
- **Method discovery**: `list-methods` command lists 115+ known bot-accessible methods
- **Agent-friendly output**: JSON-only stdout, human messages on stderr, exit codes (0/1/2)
- **23 tests passing**: 10 parse-args unit, 6 error formatting unit, 7 CLI integration

### Commit 3: Automatic pagination support
- **`--paginate` flag**: Automatically fetches all pages of cursor-paginated results and merges into a single response
- **`mergePages()` function**: Pure function in `src/paginate.ts` — iterates async iterable of pages, concatenates array fields, preserves scalar values from last page
- **Leverages `WebClient.paginate()`**: Uses the SDK's built-in cursor pagination — no manual cursor management
- **27 tests passing**: 5 new paginate unit tests, 1 new CLI integration test

### Commit 4: --dry-run flag + spec file relocation
- **`--dry-run` flag**: Previews the resolved API request without making it. Outputs method, params, token presence, pagination intent, and warnings for unknown methods.
- **Token not required for dry-run**: Reports `token_present: true/false` but does not fail — useful for parameter validation before token setup
- **Unknown method warning**: If method is not in KNOWN_METHODS, adds a warning field without failing
- **Spec relocation**: Moved APPLICATION-SPEC.md to nori-slack-cli/spec/ per spec requirements
- **32 tests passing**: 5 new dry-run CLI integration tests

## What Works
- `nori-slack chat.postMessage --channel C123 --text "hello"` (with valid SLACK_BOT_TOKEN)
- `nori-slack conversations.list --limit 10`
- `nori-slack conversations.list --paginate` (fetches all pages automatically)
- `echo '{"channel":"C123","text":"hi"}' | nori-slack chat.postMessage --json-input`
- `nori-slack chat.postMessage --dry-run --channel C123 --text "hello"` (previews request)
- `nori-slack list-methods`
- Structured error output for missing token, invalid auth, rate limits, network errors

## Next Steps
- Build and PATH registration verification (`npm run build` → `npm link`)
- Additional help text improvements for agent consumption
