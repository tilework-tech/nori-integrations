# Noridoc: nori-broker-cli/src

Path: @/nori-broker-cli/src

### Overview
- Contains all source modules for the broker CLI: entry point, HTTP client, error formatter, and per-domain command modules
- Compiles from `src/` to `dist/` via TypeScript (ES2022 target, Node16 module resolution)

### How it fits into the larger codebase
- [index.ts](index.ts) is the CLI entry point (shebang `#!/usr/bin/env node`), compiled to `dist/index.js` and exposed as the `nori-broker` binary via `package.json` `bin` field
- [client.ts](client.ts) and [errors.ts](errors.ts) are shared infrastructure used by every command module in [commands/](commands/)
- The command modules map directly to broker API domain areas -- they are thin wrappers that translate CLI flags into HTTP calls

### Core Implementation

**Entry point (`index.ts`)**
- Creates a Commander program, registers all command groups, and parses args
- When no arguments are provided (`process.argv.length <= 2`), writes help to stderr and exits with code 2

**HTTP client (`client.ts`)**
- `BrokerClient` wraps native `fetch` with a base URL and optional bearer token
- `buildHeaders` conditionally adds `Authorization` and `Content-Type: application/json`
- On network errors, throws `{ type: 'network', message }`. On non-2xx responses, throws `{ type: 'http', status, body }`
- `downloadBinary` is a specialized POST method that returns raw `ArrayBuffer` data plus lowercased response headers -- used for binary artifact retrieval

**Error formatting (`errors.ts`)**
- `formatError(input, sourceDir)` returns a `CliError` with fields: `ok`, `error`, `message`, `suggestion`, `source`
- HTTP status mapping: 401 -> `unauthorized`, 403 -> `forbidden`, 404 -> `not_found`, 500 -> `server_error`, 529 -> `no_capacity`, others -> `http_{status}`

**Command modules (`commands/`)**
- Each module exports a `registerX(program)` function that adds a subcommand group
- Command groups and the API domains they cover:

| Command Group | API Domain | Auth Required |
|---|---|---|
| `health` | `/api/health` | No |
| `sessions` | `/api/sessions/*` | Yes |
| `fleet` | `/api/fleet/*` | Mixed (status=no, rest=yes) |
| `scripts` | `/api/scripts/versions/*` | Yes |
| `notifications` | `/api/notifications/*` | Yes |
| `integrations` | `/api/integrations/*` | Yes |
| `onboarding` | `/api/onboarding/status` | Yes |
| `triggers` | `/api/triggers/*` | Yes |
| `webhook` | `/api/webhook/*` | No |
| `stats` | `/api/stats/sessions` | Yes |
| `e2e` | `/api/e2e/adopt` | Yes |

### Things to Know
- All command output goes through `process.stdout.write(JSON.stringify(result) + '\n')` -- never `console.log`, ensuring clean JSON-only stdout for agent parsing
- Error output from commands also goes to stdout as JSON (not stderr), so agents always get structured JSON regardless of success or failure. Stderr is reserved for help text only
- The `integrations` module covers Slack, GitHub, Claude, Google Workspace, and custom key-value integrations, each as separate subcommands with provider-specific option flags

Created and maintained by Nori.
