# Noridoc: nori-aws-cli

Path: @/nori-aws-cli

### Overview
- A setup/verification package for the AWS CLI v2 -- validates installation and credential configuration for non-interactive AWS API access
- Follows the same shell-script-only pattern (Pattern B) as [@/nori-gws](../nori-gws/), [@/nori-sprites](../nori-sprites/), and [@/nori-gam](../nori-gam/) since the `aws` CLI is already agent-friendly
- The sole executable is [setup.sh](setup.sh), called during sprite provisioning by the root [@/setup.sh](../setup.sh)

### How it fits into the larger codebase
- Lives in the `nori-integrations` monorepo alongside other integration packages, orchestrated by the root [setup.sh](../setup.sh) which calls `bash nori-aws-cli/setup.sh` as the 6th integration
- The broker (nori-handroll) is responsible for plumbing AWS credentials (access keys) into the sprite environment -- this package only validates that credentials exist, it does not manage them
- On success, the root setup.sh adds `- aws: AWS CLI (nori-aws-cli/)` to `~/AGENTS.md` so agents discover the AWS CLI as available tooling
- Unlike [@/nori-slack-cli](../nori-slack-cli/) and [@/nori-broker-cli](../nori-broker-cli/) which build TypeScript CLIs and symlink into `bin/`, this package produces no binary -- the system `aws` command is used directly

### Core Implementation
- [setup.sh](setup.sh) runs a sequential validation chain with three exit codes:

| Exit Code | Meaning |
|-----------|---------|
| 0 | All checks passed, aws is ready |
| 1 | Missing prerequisite (binary not found and cannot be installed, or no credentials configured) |
| 2 | Smoke test failed (`aws sts get-caller-identity` unsuccessful) |

- The validation sequence:
  1. Checks `aws` is on PATH; if missing, attempts auto-install by downloading the official Linux x86_64 zip via `curl`, extracting with `unzip`, and running the bundled installer. Falls back to exit 1 if `curl` is unavailable or the install leaves `aws` off PATH
  2. Checks for credentials using a priority cascade: environment variables (`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`), then `~/.aws/credentials` file, then named profile (`AWS_PROFILE` + `~/.aws/config`)
  3. Optionally runs `aws sts get-caller-identity` as a smoke test when `--smoke-test` flag is passed (exit 2 on failure)
- All diagnostic output goes to stderr; every error message includes a `Source:` line for traceability

### Things to Know
- The credential check is existence-only -- it confirms one of the three credential sources is present but does not validate that the keys are active or have any particular permissions. The optional `--smoke-test` flag provides that deeper validation
- Auto-installation targets the Linux x86_64 package specifically (`awscli-exe-linux-x86_64.zip`), matching the Fly.io sprite environment. The installer defaults to `/usr/local/bin` which must be on PATH for post-install detection to succeed
- The credential priority cascade (env vars > credentials file > named profile) mirrors how the AWS SDK resolves credentials, but the script checks them explicitly rather than delegating to the SDK

Created and maintained by Nori.
