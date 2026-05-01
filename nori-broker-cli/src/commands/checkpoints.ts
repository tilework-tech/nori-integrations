import path from 'node:path';
import type { Command } from 'commander';
import { requireAuth } from '../auth.js';
import { applyCheckpointBundle } from '../checkpoint/apply.js';
import { createCheckpointBundle } from '../checkpoint/bundle.js';
import type { ErrorInput } from '../errors.js';
import { runCommand } from '../runCommand.js';

const DEFAULT_TIMEOUT_MS = 60_000;

interface CreateOptions {
  sessionId: string;
  turnId: string;
  seq: string;
  spriteName: string;
  repoPath: string;
  timeoutMs?: string | null;
}

interface ApplyOptions {
  repoPath: string;
  bundlePath: string;
  expectedSha256?: string | null;
  perCommandTimeoutMs?: string | null;
}

const STRICT_INT = /^\d+$/;

const parseSeq = (raw: string): number => {
  if (STRICT_INT.test(raw) === false) {
    const err: ErrorInput = {
      type: 'invalid_seq',
      message: `--seq must be a non-negative integer, got ${raw}`,
    };
    throw err;
  }
  return Number(raw);
};

const parseTimeout = (raw: string | null | undefined): number => {
  if (raw == null || raw.length === 0) return DEFAULT_TIMEOUT_MS;
  if (STRICT_INT.test(raw) === false || raw === '0') {
    const err: ErrorInput = {
      type: 'invalid_timeout',
      message: `--timeout-ms must be a positive integer, got ${raw}`,
    };
    throw err;
  }
  return Number(raw);
};

export const registerCheckpoints = (args: { program: Command }): void => {
  const { program } = args;
  const checkpoint = program
    .command('checkpoint')
    .description(
      'Create and upload sprite-side code checkpoints to the broker',
    );

  checkpoint
    .command('create')
    .description(
      'Create a git bundle of the current workspace and upload it as a checkpoint',
    )
    .requiredOption('--session-id <id>', 'ACP session id')
    .requiredOption('--turn-id <id>', 'turn identifier')
    .requiredOption('--seq <n>', 'event seq number for this checkpoint')
    .requiredOption('--sprite-name <name>', 'sprite name')
    .requiredOption(
      '--repo-path <path>',
      'absolute path to the workspace git repo',
    )
    .option(
      '--timeout-ms <ms>',
      'wall clock budget for the upload (default 60000)',
    )
    .action(
      runCommand(async (opts: CreateOptions) => {
        const { client } = requireAuth();

        const seq = parseSeq(opts.seq);
        const timeoutMs = parseTimeout(opts.timeoutMs ?? null);
        const repoPath = path.resolve(opts.repoPath);

        const bundle = createCheckpointBundle({
          repoPath,
          turnId: opts.turnId,
        });

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          return await client.postMultipart({
            path: '/api/checkpoints',
            parts: {
              metadata: {
                spriteName: opts.spriteName,
                sessionId: opts.sessionId,
                turnId: opts.turnId,
                seq,
                repoSha: bundle.repoSha,
                bundleSha256: bundle.bundleSha256,
              },
              bundle: {
                bytes: bundle.bundleBytes,
                filename: `turn=${opts.turnId}.bundle`,
              },
            },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
          bundle.cleanup();
        }
      }),
    );

  checkpoint
    .command('apply')
    .description(
      'Apply a previously-uploaded checkpoint bundle into a target workspace',
    )
    .requiredOption(
      '--repo-path <path>',
      'absolute path to the workspace directory to populate (must be empty or non-existent)',
    )
    .requiredOption(
      '--bundle-path <path>',
      'absolute path to the local .bundle file to apply',
    )
    .option(
      '--expected-sha256 <hex>',
      'verify the bundle file against this SHA-256 before applying',
    )
    .option(
      '--per-command-timeout-ms <ms>',
      'timeout for each git invocation (default 15000)',
    )
    .action(
      runCommand(async (opts: ApplyOptions) => {
        const repoPath = path.resolve(opts.repoPath);
        const bundlePath = path.resolve(opts.bundlePath);
        const perCommandTimeoutMs =
          opts.perCommandTimeoutMs == null ||
          opts.perCommandTimeoutMs.length === 0
            ? null
            : parseTimeout(opts.perCommandTimeoutMs);

        const result = applyCheckpointBundle({
          repoPath,
          bundlePath,
          expectedSha256: opts.expectedSha256 ?? null,
          perCommandTimeoutMs,
        });
        return { ok: true, ...result };
      }),
    );
};
