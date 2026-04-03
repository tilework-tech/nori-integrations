# Current Progress

## Status: Core CLI Implemented

The nori-slack-cli project is scaffolded and the core CLI infrastructure is working with 23 passing tests.

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

## What Works
- `nori-slack chat.postMessage --channel C123 --text "hello"` (with valid SLACK_BOT_TOKEN)
- `nori-slack conversations.list --limit 10`
- `echo '{"channel":"C123","text":"hi"}' | nori-slack chat.postMessage --json-input`
- `nori-slack list-methods`
- Structured error output for missing token, invalid auth, rate limits, network errors

## Next Steps
- Build and PATH registration (`npm run build` → `npm link`)
- Move APPLICATION-SPEC.md to nori-slack-cli/spec/ as spec says
- Consider adding `--paginate` convenience flag for cursor-based pagination
- Consider adding `--dry-run` flag for input validation without API calls
