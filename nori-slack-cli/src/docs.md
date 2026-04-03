# Noridoc: nori-slack-cli/src

Path: @/nori-slack-cli/src

### Overview
- Contains all source modules for the CLI: entry point, argument parsing, error formatting, and the known-methods catalog
- Compiles from `src/` to `dist/` via TypeScript (ES2022 target, Node16 module resolution)

### How it fits into the larger codebase
- [index.ts](index.ts) is the CLI entry point (shebang `#!/usr/bin/env node`), compiled to `dist/index.js` and exposed as the `nori-slack` binary via `package.json` `bin` field
- [parse-args.ts](parse-args.ts) and [errors.ts](errors.ts) are pure utility modules with no side effects -- they are independently testable and tested in [@/nori-slack-cli/test](../test/)
- [methods.ts](methods.ts) is a static data file; it is only used by the `list-methods` subcommand and has no effect on which methods the CLI can actually call

### Core Implementation

**Entry point (`index.ts`)**
- Sets up Commander with two code paths: `list-methods` subcommand and the default dynamic method handler
- The dynamic handler: validates `SLACK_BOT_TOKEN` env var, optionally reads JSON from stdin, parses CLI flags, merges params (CLI flags win over stdin), calls `WebClient.apiCall()`, writes result JSON to stdout
- When no arguments are provided (`process.argv.length <= 2`), help text and error go to stderr and the process exits with code 2

**Argument parsing (`parse-args.ts`)**
- `parseArgs(argv)` walks the args array linearly, handling three patterns: `--key value`, `--key=value`, and standalone `--flag` (boolean true)
- `kebabToSnake` converts all flag names from CLI convention to Slack API convention
- `coerceValue` applies type inference: `"true"`/`"false"` become booleans, numeric strings become numbers (except those with leading zeros), and strings starting with `[` or `{` are attempted as JSON parse

**Error formatting (`errors.ts`)**
- `formatError(error, sourceDir)` returns a `CliError` object with fields: `ok`, `error`, `message`, `suggestion`, `source`
- Handles four specific `@slack/web-api` error codes: `slack_webapi_platform_error`, `slack_webapi_rate_limited_error`, `slack_webapi_request_error`, and the custom `no_token`
- The `SUGGESTIONS` map provides agent-friendly remediation text for common Slack platform errors like `channel_not_found`, `not_in_channel`, `invalid_auth`, `rate_limited`, etc.

**Methods catalog (`methods.ts`)**
- `KNOWN_METHODS` is a static string array of Slack Web API methods available to bot tokens
- Serves as a discoverability aid only; the comment in the file explicitly notes the CLI is not limited to these methods

### Things to Know
- The `--json-input` flag is consumed by Commander as a known option; all other flags pass through via `allowUnknownOption()` and are parsed by `parseArgs` from `command.args`
- When both stdin JSON and CLI flags provide the same key, the CLI flag value wins due to spread order: `{ ...stdinParams, ...cliParams }`
- Non-flag arguments (tokens not starting with `--`) are silently skipped by `parseArgs` -- they do not cause errors
- Rate limit errors extract `retryAfter` from the `@slack/web-api` error object and include the retry duration in the message

Created and maintained by Nori.
