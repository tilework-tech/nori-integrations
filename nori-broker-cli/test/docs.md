# Noridoc: nori-broker-cli/test

Path: @/nori-broker-cli/test

### Overview
- Vitest test suite for the nori-broker-cli package
- Tests cover the CLI command surface, HTTP client behavior, error formatting, and TypeScript build output

### How it fits into the larger codebase
- Package-level tests live here; repo-wide integration tests for `setup.sh` (including nori-broker symlink verification) live in [@/test](../../test/)
- Follows the same testing pattern as [@/nori-slack-cli/test](../../nori-slack-cli/test/)

### Core Implementation
- `cli.test.ts` -- Tests the Commander program structure by importing the program and inspecting registered commands and their subcommands. Verifies command names, descriptions, and option definitions without making HTTP calls
- `client.test.ts` -- Tests `BrokerClient` by mocking global `fetch`. Verifies correct URL construction, header assembly (bearer token, content-type), query string building, HTTP method dispatch, and error throwing behavior for network failures and non-2xx responses
- `errors.test.ts` -- Tests `formatError` for each error type (no_token, no_broker_url, network, HTTP status codes including 401, 403, 404, 500, 529, and unknown statuses). Verifies the structured `CliError` shape
- `build.test.ts` -- Tests that the TypeScript build output (`dist/index.js`) exists, has a shebang line, and is executable

### Things to Know
- Tests mock `fetch` at the global level, not via an HTTP interception library -- this matches the client's use of native `fetch`
- No test makes actual network calls; the CLI's value as a thin HTTP wrapper means the tests focus on correct request construction and response/error handling rather than end-to-end behavior

Created and maintained by Nori.
