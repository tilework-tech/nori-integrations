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

## `describe <method>` Command Design

### Problem
Agents need to know what parameters a Slack API method accepts before calling it. Currently the only discovery is `list-methods` which just lists names.

### Runtime metadata availability
- `@slack/web-api` has NO runtime parameter metadata — only TypeScript `.d.ts` files
- The `.js` files for request types are empty stubs (interfaces erased at compile time)
- Slack publishes OpenAPI specs on GitHub but they are not bundled with the npm package

### Approach: Static method metadata map
Create `src/method-metadata.ts` with a hand-curated map of commonly used methods and their parameters. Structure:
```typescript
interface MethodMetadata {
  description: string;
  required: Record<string, string>; // param name -> type/description
  optional: Record<string, string>;
  supports_pagination?: boolean;
  deprecated?: string; // deprecation message
}
```

For methods not in the map, output a helpful fallback pointing to Slack API docs URL.

### Methods to document (high-value for agents)
chat.postMessage, chat.update, chat.delete, conversations.list, conversations.history,
conversations.create, conversations.invite, conversations.info, conversations.members,
conversations.replies, reactions.add, reactions.remove, users.list, users.info,
files.getUploadURLExternal, files.completeUploadExternal, files.upload (deprecated notice),
pins.add, pins.remove, bookmarks.add, reminders.add, reminders.list

### Key finding: files.upload deprecated
`files.upload` stopped working Nov 2025. Replaced by two-step flow:
1. `files.getUploadURLExternal` (filename, length) → returns upload URL + file_id
2. Upload file content to the URL via HTTP PUT
3. `files.completeUploadExternal` (files array) → finishes and shares the file

### Output format for `describe`
```json
{
  "ok": true,
  "method": "chat.postMessage",
  "description": "Sends a message to a channel.",
  "required_params": { "channel": "Channel ID (e.g., C1234567890)" },
  "optional_params": { "text": "Message text", "blocks": "Array of Block Kit blocks (JSON)" },
  "supports_pagination": false,
  "docs_url": "https://api.slack.com/methods/chat.postMessage"
}
```

## Build and PATH Registration (Verified)

- `npm run build` compiles TypeScript → `dist/`, runs `chmod +x dist/index.js && npm link`
- `npm link` creates a global symlink: `nori-slack` → package's `dist/index.js`
- Shebang `#!/usr/bin/env node` is already present in `src/index.ts`
- Verified: after `npm run build`, `which nori-slack` resolves and `nori-slack --version` outputs `0.1.0`
- No code changes needed — build pipeline already works correctly

## Build Verification Test

### Goal
Automated test that verifies the TypeScript build produces a working CLI binary.

### What to test
1. `tsc` compiles without errors
2. `dist/index.js` exists and starts with `#!/usr/bin/env node` shebang
3. The compiled binary responds to `--version` with `0.1.0`
4. The compiled binary responds to `list-methods` with valid JSON
5. The compiled binary responds to `--help` with usage information

### Key decisions
- **Run `tsc` directly, not `npm run build`**: The `postbuild` script runs `npm link` which creates global symlinks — inappropriate for automated tests and may require elevated permissions
- **Use `node dist/index.js` to execute**: Avoids dependency on PATH registration; tests the compiled output directly
- **Separate test file**: `test/build.test.ts` — build tests are slower (involves `tsc` compilation) and conceptually distinct from CLI behavior tests
- **Single `tsc` invocation**: Run build once in a `beforeAll`, then assert multiple properties — avoids recompiling for each test
- **Check file permissions with `fs.stat`**: On Unix, verify the executable bit is set after compilation

### Timeout considerations
- `tsc` compilation takes a few seconds; use 30s timeout on the build step
- Individual assertions after build are fast (< 1s each)

## Expanding Method Metadata

### Current state
- 120 methods in KNOWN_METHODS (`src/methods.ts`)
- 26 methods have metadata in METHOD_METADATA (`src/method-metadata.ts`)
- 94 methods missing: api, assistant, auth, bookmarks (edit/list/remove), bots, calls, canvases, chat (remaining), conversations (remaining), dialog, dnd, emoji, files (remaining), migration, pins.list, reactions.get, reminders (remaining), team, usergroups, users (remaining), views, workflows

### Approach
Add metadata for all remaining KNOWN_METHODS, organized by namespace. Each entry needs:
- `description`: one-line summary
- `required_params`: Record<string, string> of required parameters
- `optional_params`: Record<string, string> of optional parameters
- `supports_pagination`: boolean (true for methods in the CursorPaginationEnabled list)
- `deprecated?`: deprecation notice if applicable
- `docs_url`: generated from `docsUrl()` helper

### Pagination-supporting methods (from SDK)
conversations.list, conversations.history, conversations.members, conversations.replies,
users.list, users.conversations, chat.scheduledMessages.list, reactions.list,
files.info, files.remote.list, team.accessLogs, team.billableInfo, auth.teams.list

## Method Name Fuzzy Matching / Typo Correction

### Problem
When an agent misspells a method name (e.g., `chat.postmessage` instead of `chat.postMessage`, or `converations.list` typo), the CLI provides no suggestions. The spec requires "every error should suggest alternatives."

### Approach
Create `src/suggest.ts` with a `findSimilarMethods()` function:
1. **Case-insensitive exact match first** — handles `chat.postmessage` → `chat.postMessage` for free
2. **Levenshtein distance** for fuzzy matching — find methods within a reasonable edit distance
3. **Threshold** — only suggest methods where `distance <= max(3, method.length * 0.4)` to avoid nonsensical suggestions
4. **Return top 3** suggestions sorted by distance

### Dependency decision
Implementing Levenshtein inline (~15 lines). The `fastest-levenshtein` package would also work, but the algorithm is trivial and avoids adding a dependency for a single function.

### Integration points
1. **`--dry-run` warning** (index.ts lines 124-126) — add suggestions to the warning when method is not in KNOWN_METHODS
2. **Pre-API-call warning** — when method is not in KNOWN_METHODS, output a stderr warning with suggestions before calling the API
3. **`method_not_found` error** — add method suggestions to the `formatError` suggestion field via new `SUGGESTIONS.method_not_found` that dynamically computes suggestions

### Output format
```json
{
  "warning": "Method 'chat.postmesage' is not in the known methods list. Did you mean: chat.postMessage?",
  "suggestions": ["chat.postMessage", "chat.meMessage"]
}
```

### Commander.js note
Commander v13 has `.showSuggestionAfterError()` for subcommands, but our `<method>` argument bypasses that — needs custom implementation.

## Enhanced `list-methods` with Namespace Grouping and Filtering

### Problem
Currently `list-methods` outputs a flat JSON array of 120 method names. An agent has no context about what each method does without calling `describe` individually for each one. This makes method discovery tedious.

### Approach
Add options to the `list-methods` command:
- `--namespace <ns>`: Filter methods to a specific namespace prefix (e.g., `--namespace chat` shows only `chat.*` methods)
- `--descriptions`: Include method description from METHOD_METADATA alongside each method name

### Output format decisions
- Default (no flags): Keep current `{ methods: string[] }` for backward compatibility
- With `--descriptions`: Change to `{ methods: Array<{ method: string, description: string }> }` — richer objects instead of plain strings
- With `--namespace <ns>`: Filter the methods array to only matching namespace, add `namespace` field to response
- Both flags compose: `--namespace chat --descriptions` returns filtered methods with descriptions

### Commander.js v13 pattern
Commander v13 supports `.option()` chained on subcommands. Options are passed to the action callback as first arg (since no positional args).
```typescript
.command('list-methods')
.option('--namespace <ns>', 'Filter by namespace')
.option('--descriptions', 'Include descriptions')
.action((opts) => { /* opts.namespace, opts.descriptions */ })
```

### Namespace extraction
Method names are dot-delimited. The namespace is the first segment: `chat.postMessage` → `chat`, `conversations.history` → `conversations`. Extract via `method.split('.')[0]`.

### Descriptions source
All 120 KNOWN_METHODS have entries in METHOD_METADATA (verified by existing coverage guard test). Use `getMethodMetadata(method).description` to get descriptions.
