# Noridoc: nori-slack-cli/src

Path: @/nori-slack-cli/src

### Overview
- Contains all source modules for the CLI: entry point, argument parsing, error formatting, pagination merging, fuzzy method suggestion, the known-methods catalog, and the method metadata registry
- Compiles from `src/` to `dist/` via TypeScript (ES2022 target, Node16 module resolution)

### How it fits into the larger codebase
- [index.ts](index.ts) is the CLI entry point (shebang `#!/usr/bin/env node`), compiled to `dist/index.js` and exposed as the `nori-slack` binary via `package.json` `bin` field
- [parse-args.ts](parse-args.ts), [errors.ts](errors.ts), and [paginate.ts](paginate.ts) are pure utility modules with no side effects -- they are independently testable and tested in [@/nori-slack-cli/test](../test/)
- [methods.ts](methods.ts) is a static data file; it is only used by the `list-methods` subcommand and has no effect on which methods the CLI can actually call

### Core Implementation

**Entry point (`index.ts`)**
- Sets up Commander with three subcommands: `list-methods`, `describe`, and the default dynamic method handler
- The dynamic handler: optionally reads JSON from stdin, parses CLI flags, merges params (CLI flags win over stdin), then branches into three paths:
  1. `--dry-run`: short-circuits immediately after param resolution -- outputs a JSON preview with `ok`, `dry_run`, `method`, `params`, `token_present`, `paginate`, and optionally a `warning` for unknown methods. Does not require a token. Always exits 0.
  2. `--paginate`: validates token, then calls `client.paginate()` + `mergePages()`
  3. Default: validates token, then calls `client.apiCall()`
- When no arguments are provided (`process.argv.length <= 2`), help text and error go to stderr and the process exits with code 2
- The `list-methods` subcommand supports two options that compose together: `--namespace <ns>` filters the method list to those starting with the given prefix (e.g., `chat.`), and `--descriptions` changes the output shape from `string[]` to `Array<{ method, description }>` by pulling descriptions from `getMethodMetadata()`. When `--namespace` is provided, a `namespace` field is added to the response JSON.

**Pagination merging (`paginate.ts`)**
- `mergePages(pages)` takes an `AsyncIterable` of page objects and returns a single merged object
- Array-valued keys are concatenated across pages; scalar/metadata keys (`ok`, `response_metadata`, `headers`, `warning`) are overwritten with the last page's value
- This design means the function works generically with any Slack method's response shape -- it does not need to know which key holds the data (e.g., `channels`, `members`, `messages`)

**Argument parsing (`parse-args.ts`)**
- `parseArgs(argv)` walks the args array linearly, handling three patterns: `--key value`, `--key=value`, and standalone `--flag` (boolean true)
- `kebabToSnake` converts all flag names from CLI convention to Slack API convention
- `coerceValue` applies type inference: `"true"`/`"false"` become booleans, numeric strings become numbers (except those with leading zeros), and strings starting with `[` or `{` are attempted as JSON parse

**Error formatting (`errors.ts`)**
- `formatError(error, sourceDir)` returns a `CliError` object with fields: `ok`, `error`, `message`, `suggestion`, `source`
- Handles four specific `@slack/web-api` error codes: `slack_webapi_platform_error`, `slack_webapi_rate_limited_error`, `slack_webapi_request_error`, and the custom `no_token`
- The `SUGGESTIONS` map provides agent-friendly remediation text for common Slack platform errors like `channel_not_found`, `not_in_channel`, `invalid_auth`, `rate_limited`, etc.

**Fuzzy method suggestion (`suggest.ts`)**
- `findSimilarMethods(input, methods?, maxResults?)` returns up to 3 similar method names from `KNOWN_METHODS` for typo correction
- Three-tier matching: exact match returns `[]` (no suggestions needed), case-insensitive exact match returns the correctly-cased method as a fast path, then Levenshtein distance ranking with a dynamic threshold of `max(3, floor(input.length * 0.4))`
- Levenshtein comparison is case-insensitive (both sides lowercased) to maximize match quality
- Used in `index.ts` at two integration points: the `--dry-run` path adds `suggestions` array and enriched `warning` to the JSON output, and the pre-API-call path emits a stderr warning with "Did you mean: X?"

**Methods catalog (`methods.ts`)**
- `KNOWN_METHODS` is a static string array of Slack Web API methods available to bot tokens
- Serves as a discoverability aid only; the comment in the file explicitly notes the CLI is not limited to these methods

**Method metadata (`method-metadata.ts`)**
- `METHOD_METADATA` is a static `Record<string, MethodMetadata>` map providing parameter documentation for every method in `KNOWN_METHODS`
- Each entry includes: `description`, `required_params`, `optional_params` (both `Record<string, string>` mapping param name to human-readable description), `supports_pagination` (boolean), optional `deprecated` notice, and `docs_url`
- `getMethodMetadata(method)` looks up the map and returns the entry if present; for unknown methods, it returns a fallback with empty params and a generated docs URL
- The `docsUrl()` helper constructs URLs in the form `https://api.slack.com/methods/{method}`
- The `describe` command in [index.ts](index.ts) wraps `getMethodMetadata` output with `ok`, `method`, and `known` fields (where `known` is `true` only when the method has a curated entry in `METHOD_METADATA`)

### Things to Know
- `--json-input`, `--paginate`, and `--dry-run` are consumed by Commander as known options; all other flags pass through via `allowUnknownOption()` and are parsed by `parseArgs` from `process.argv`
- The raw args filter explicitly strips `--json-input`, `--paginate`, and `--dry-run` before passing to `parseArgs`, preventing them from being sent as Slack API parameters
- When both stdin JSON and CLI flags provide the same key, the CLI flag value wins due to spread order: `{ ...stdinParams, ...cliParams }`
- Non-flag arguments (tokens not starting with `--`) are silently skipped by `parseArgs` -- they do not cause errors
- Rate limit errors extract `retryAfter` from the `@slack/web-api` error object and include the retry duration in the message

Created and maintained by Nori.
