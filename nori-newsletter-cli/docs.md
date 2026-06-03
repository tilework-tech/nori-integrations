# Noridoc: nori-newsletter-cli

Path: @/nori-newsletter-cli

### Overview
- A setup/verification package for the `nori-newsletter` CLI -- validates installation, AWS credentials, AWS region, and a JSON config file for newsletter management via AWS SES
- Follows the shell-script-only pattern (Pattern B) like [@/nori-aws-cli](../nori-aws-cli/), [@/nori-sprites](../nori-sprites/), and [@/nori-gam](../nori-gam/) since the `nori-newsletter` CLI is already agent-friendly
- The sole executable is [setup.sh](setup.sh), called during sprite provisioning by the root [@/setup.sh](../setup.sh)

### How it fits into the larger codebase
- Lives in the `nori-integrations` monorepo, orchestrated by the root [setup.sh](../setup.sh) which calls `bash nori-newsletter-cli/setup.sh` as one step in the setup sequence
- On success, the root setup.sh adds `nori-newsletter` to `~/AGENTS.md` so agents discover it as available tooling, pulling capability details from [CAPABILITIES.md](CAPABILITIES.md)
- This package produces no binary -- the globally-installed `nori-newsletter` command is used directly
- Shares the same AWS credential validation approach as [@/nori-aws-cli](../nori-aws-cli/) (env vars > credentials file > named profile), but additionally requires `AWS_REGION` and optionally validates a JSON config file
- The underlying `nori-newsletter` npm package (source at `~/code/nori/nori-newsletter-cli`) wraps AWS SES for contact list management and email sending

### Core Implementation
- [setup.sh](setup.sh) runs a sequential validation chain with three exit codes:

| Exit Code | Meaning |
|-----------|---------|
| 0 | All checks passed, nori-newsletter is ready |
| 1 | Missing prerequisite (binary, credentials, or region) |
| 2 | Smoke test failed (`nori-newsletter contacts list` unsuccessful) |

- The validation sequence:
  1. Checks `nori-newsletter` is on PATH; if missing, attempts `npm install -g nori-newsletter-cli`. Fails with exit 1 if npm is unavailable, if the install command fails, or if the binary is still not on PATH after installation
  2. Checks for AWS credentials using the same priority cascade as nori-aws-cli: environment variables (`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`), then `~/.aws/credentials` file, then named profile (`AWS_PROFILE` + `~/.aws/config`)
  3. Requires `AWS_REGION` to be set (SES is region-scoped)
  4. Validates `NEWSLETTER_CONFIG_FILE` env var if set -- checks that the file exists, is valid JSON, and contains four required keys (`contactListName`, `topicName`, `fromAddress`, `replyTo`). Issues warnings for any issues but does not fail setup. Uses `node -e` to parse and validate the JSON (Node.js is guaranteed available since the CLI itself requires it)
  5. Optionally runs `nori-newsletter contacts list` as a smoke test when `--smoke-test` flag is passed (exit 2 on failure)
- All diagnostic output goes to stderr; every error message includes a `Source:` line for traceability
- [newsletter.config.example.json](newsletter.config.example.json) provides a template showing the required config keys with placeholder values

### Things to Know
- The config validation uses `node -e` rather than `jq` because the nori-newsletter CLI already depends on Node.js, making it a guaranteed dependency -- `jq` would be an additional system requirement
- The credential check is existence-only, same as nori-aws-cli -- it confirms a credential source is present but does not validate permissions. The optional `--smoke-test` flag provides deeper validation by actually calling SES
- Installation uses `npm install -g` rather than the curl/unzip approach used by [@/nori-aws-cli](../nori-aws-cli/), since nori-newsletter is distributed as an npm package
- The config file path is passed via `NEWSLETTER_CONFIG_FILE` env var rather than a conventional config location, allowing different newsletter configs per deployment

Created and maintained by Nori.
