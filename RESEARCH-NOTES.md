# Research Notes

## Key Architectural Decision: Dynamic Dispatch via apiCall()

The `@slack/web-api` WebClient has a `client.apiCall(methodName, params)` method that can call ANY Slack Web API method by name. This means we do NOT need to enumerate 200+ commands individually. Instead:

- `nori-slack chat.postMessage --channel C123 --text "hello"`
- translates to `client.apiCall('chat.postMessage', { channel: 'C123', text: 'hello' })`

This gives us automatic 1:1 mapping to the full API surface without maintaining per-method code.

## CLI Framework: Commander.js

- 35M+ weekly downloads, zero dependencies
- Simple declarative API
- Use `.argument('<method>')` with `.allowUnknownOption()` for dynamic dispatch
- Alternative considered: yargs (heavier), oclif (overkill)

## Agent-Consumable CLI Patterns

- JSON-only output to stdout, human messages to stderr
- No interactive prompts, auth via SLACK_BOT_TOKEN env var
- Structured errors: `{ ok: false, error: "code", message: "details", suggestion: "try X" }`
- Source path in every error so agent can inspect CLI code
- Exit codes: 0 success, 1 API error, 2 usage error

## @slack/web-api Key Facts

- Latest v7.x, requires Node 18+
- Error codes: PlatformError, RequestError, RateLimitedError
- Built-in pagination: `for await (const page of client.paginate(method))`
- Bot tokens support ~170 methods; admin/search/stars require user tokens

## PATH Registration

- `npm link` in postbuild script creates symlink from global bin to package bin entry
- Alternative: explicit symlink to ~/.local/bin/

## Slack API Namespaces (bot-accessible)

chat, conversations, reactions, files, users, usergroups, pins, bookmarks,
reminders, team, views, bots, calls, canvases, dnd, emoji, auth, api,
assistant, functions, workflows, migration, rtm

## User-only methods (excluded from bot CLI)

admin.*, search.*, stars.*, users.profile.set, users.deletePhoto,
users.setPhoto, users.identity

## Pagination in @slack/web-api

### `client.paginate()` API
- Three overloads: (1) async iterable, (2) shouldStop predicate, (3) shouldStop + reduce
- `paginate(method, options)` returns `AsyncIterable<WebAPICallResult>` — iterate with `for await`
- Does NOT auto-merge results — each page is a separate response object
- Default page size: 200. If `options.limit` is set, it becomes the page size

### How cursor pagination works
- Response includes `response_metadata.next_cursor` when more pages exist
- Pagination ends when `next_cursor` is `undefined` or `''`
- `paginationOptionsForNextPage()` helper returns `{ limit, cursor }` or `undefined`

### Methods supporting cursor pagination (from CursorPaginationEnabled interface)
conversations.list, conversations.history, conversations.members, conversations.replies,
users.list, users.conversations, chat.scheduledMessages.list, reactions.list,
files.info, files.remote.list, team.accessLogs, team.billableInfo, auth.teams.list

### Response data keys vary by method
- conversations.list → `channels`
- users.list → `members`
- conversations.history → `messages`
- reactions.list → `items`

### Approach for --paginate flag
Use `for await (const page of client.paginate(method, params))` to iterate all pages.
For each page, find array-valued keys (excluding `ok`, `response_metadata`, `headers`, etc.)
and concatenate them across pages. Return a single merged response object.

## --dry-run Flag Design

### Output format
Structured JSON matching existing conventions:
```json
{
  "ok": true,
  "dry_run": true,
  "method": "chat.postMessage",
  "params": { "channel": "C123", "text": "Hello" },
  "token_present": true,
  "paginate": false
}
```

### Key decisions
- **Don't require token**: Report `token_present: true/false` but don't exit(1) — dry-run previews the request, not runtime requirements
- **Warn on unknown methods**: If method not in KNOWN_METHODS, add `"warning"` field but don't fail — unknown methods may be valid
- **Exit code 0**: Dry-run that resolves successfully always exits 0. Input parsing errors (bad JSON stdin) still exit 2.
- **--paginate + --dry-run**: Note pagination was requested in output but don't attempt it
- **Filter from rawArgs**: Same pattern as --json-input and --paginate on line 77 of index.ts

## Spec File Relocation

Per APPLICATION-SPEC.md: "When complete, move the APPLICATION-SPEC.md and any other spec md files to a nori-slack-cli/spec folder."
- Create `nori-slack-cli/spec/` directory
- Move APPLICATION-SPEC.md into it
