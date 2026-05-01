# Noridoc: nori-broker-cli

Path: @/nori-broker-cli

### Overview
- A TypeScript CLI that maps 1:1 to the nori broker HTTP API, designed for agent consumption
- All output is JSON on stdout, errors on stderr; uses Commander.js with nested subcommand groups (e.g., `nori-broker sessions list`, `nori-broker fleet set-size --size 5`)
- Uses native Node.js `fetch` with bearer token auth -- no external HTTP library

### How it fits into the larger codebase
- Follows the same build/distribution pattern as [@/nori-slack-cli](../nori-slack-cli/): TypeScript project, `npm install && npm run build`, symlinked into `bin/nori-broker` by [@/setup.sh](../setup.sh)
- The broker server it targets is the same system that clones this toolshed repo onto sprites. This means agents on sprites can use `nori-broker` to manage the very broker that provisioned them
- Auth via `NORI_BROKER_URL` and `NORI_BROKER_TOKEN` environment variables; some commands (health, fleet status, webhook fire) work without a token
- Unlike nori-slack-cli which wraps a third-party SDK with dynamic dispatch, this CLI has a fixed command surface that mirrors specific broker API endpoints

### Core Implementation
- Entry point is [src/index.ts](src/index.ts), which registers command groups and delegates to per-domain command modules in [src/commands/](src/commands/)
- [src/auth.ts](src/auth.ts) exports a shared `requireAuth()` function (validates `NORI_BROKER_URL` and `NORI_BROKER_TOKEN`, returns a `BrokerClient`) and `SOURCE_DIR` (resolved package root path). All command modules import from this single file
- [src/client.ts](src/client.ts) (`BrokerClient`) provides `get`, `post`, `put`, `delete`, `downloadBinary`, and `postMultipart` methods. On HTTP errors, parses the response body as JSON and extracts the `error` field if present (matching the broker server's `{"error":"..."}` response format), falling back to raw text. Throws structured error objects (`{ type, status?, body?, message? }`) that the error formatter consumes
- [src/errors.ts](src/errors.ts) (`formatError`) converts error objects into `CliError` JSON with `ok: false`, human-readable `message`, `suggestion`, and `source` (filesystem path to CLI source directory). Handles `no_token`, `no_broker_url`, `network`, checkpoint create/apply errors (`bundle_not_found`, `bundle_sha_mismatch`, `target_not_empty`, `invalid_bundle`, etc.), and HTTP status codes (401, 403, 404, 500, 503, 529)
- Each command module follows a uniform pattern: a `registerX(program)` function that creates a subcommand group, with each subcommand calling `requireAuth()` (or constructing a client directly for unauthenticated endpoints), making one HTTP call, and writing JSON to stdout
- [src/checkpoint/bundle.ts](src/checkpoint/bundle.ts) and [src/checkpoint/apply.ts](src/checkpoint/apply.ts) implement the sprite-side workspace-capture and bundle-apply primitives that back the `checkpoint create` and `checkpoint apply` subcommands. `bundle.ts` builds a `git bundle` of the current workspace (tracked + untracked, `.gitignore`-respecting) using a separate `GIT_INDEX_FILE` so the user's working tree, index, and branch HEAD are never touched. `apply.ts` verifies an optional SHA-256 before any filesystem mutation and pipes `git init` / `fetch` / `update-ref` / `reset --hard` against an empty target. These primitives are what enables broker-side session resume: the broker triggers `checkpoint create` after each ACP turn and runs `checkpoint apply` on a fresh sprite when a Slack thread reply must restore from S3

### Things to Know
- `SOURCE_DIR` resolves to the nori-broker-cli package root at runtime via `import.meta.url` in [src/auth.ts](src/auth.ts), so every error response includes the exact filesystem path to the CLI source for agent debugging
- The broker server returns JSON error bodies (e.g., `{"error":"Invalid or expired token"}`). The client extracts the `error` field so CLI error messages show clean strings rather than raw JSON. Non-JSON responses and JSON without an `error` field fall back to the raw response text
- The `webhook fire` command supports `--json-input` to read a JSON body from stdin, similar to nori-slack-cli's stdin input mode
- HTTP 529 is mapped to `no_capacity`, specific to the broker's fleet pool semantics
- The `fleet set-settings` command accepts timeout values as string options and parses them to integers before sending, same pattern used in `fleet set-size`

Created and maintained by Nori.
