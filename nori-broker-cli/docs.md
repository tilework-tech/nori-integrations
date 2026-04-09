# Noridoc: nori-broker-cli

Path: @/nori-broker-cli

### Overview
- A TypeScript CLI that maps 1:1 to the nori broker HTTP API, designed for agent consumption
- All output is JSON on stdout, errors on stderr; uses Commander.js with nested subcommand groups (e.g., `nori-broker sessions list`, `nori-broker fleet set-size --size 5`)
- Uses native Node.js `fetch` with bearer token auth -- no external HTTP library

### How it fits into the larger codebase
- Follows the same build/distribution pattern as [@/nori-slack-cli](../nori-slack-cli/): TypeScript project, `npm install && npm run build`, symlinked into `bin/nori-broker` by [@/setup.sh](../setup.sh)
- The broker server it targets is nori-handroll -- the same system that clones this toolshed repo onto sprites. This means agents on sprites can use `nori-broker` to manage the very broker that provisioned them
- Auth via `NORI_BROKER_URL` and `NORI_BROKER_TOKEN` environment variables; some commands (health, fleet status, webhook fire) work without a token
- Unlike nori-slack-cli which wraps a third-party SDK with dynamic dispatch, this CLI has a fixed command surface that mirrors specific broker API endpoints

### Core Implementation
- Entry point is [src/index.ts](src/index.ts), which registers command groups and delegates to per-domain command modules in [src/commands/](src/commands/)
- [src/client.ts](src/client.ts) (`BrokerClient`) provides `get`, `post`, `put`, `delete`, and `downloadBinary` methods. Throws structured error objects (`{ type, status?, body?, message? }`) that the error formatter consumes
- [src/errors.ts](src/errors.ts) (`formatError`) converts error objects into `CliError` JSON with `ok: false`, human-readable `message`, `suggestion`, and `source` (filesystem path to CLI source directory). Handles `no_token`, `no_broker_url`, `network`, and HTTP status codes (401, 403, 404, 500, 529)
- Each command module follows a uniform pattern: a `registerX(program)` function that creates a subcommand group, with each subcommand calling `requireAuth()` (or constructing a client directly for unauthenticated endpoints), making one HTTP call, and writing JSON to stdout

### Things to Know
- Every command module independently defines its own `requireAuth()` and `SOURCE_DIR` -- there is no shared helper. This is a deliberate per-file independence pattern, not accidental duplication
- `SOURCE_DIR` resolves to the nori-broker-cli package root at runtime via `import.meta.url`, so every error response includes the exact filesystem path to the CLI source for agent debugging
- The `webhook fire` command supports `--json-input` to read a JSON body from stdin, similar to nori-slack-cli's stdin input mode
- HTTP 529 is mapped to `no_capacity`, specific to the broker's fleet pool semantics
- The `fleet set-settings` command accepts timeout values as string options and parses them to integers before sending, same pattern used in `fleet set-size`

Created and maintained by Nori.
