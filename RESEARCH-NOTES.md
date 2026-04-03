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
