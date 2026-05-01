import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import type { ErrorInput } from '../errors.js';

const APPLY_AUTHOR_NAME = 'Nori';
const APPLY_AUTHOR_EMAIL = 'bot@nori.dev';
const SHA256_HEX = /^[a-f0-9]{64}$/i;
const DEFAULT_BRANCH = 'main';

const applyGitEnv = (): NodeJS.ProcessEnv => ({
  ...process.env,
  GIT_AUTHOR_NAME: APPLY_AUTHOR_NAME,
  GIT_AUTHOR_EMAIL: APPLY_AUTHOR_EMAIL,
  GIT_COMMITTER_NAME: APPLY_AUTHOR_NAME,
  GIT_COMMITTER_EMAIL: APPLY_AUTHOR_EMAIL,
});

const runGit = (args: {
  repoPath: string;
  args: string[];
  timeoutMs?: number | null;
}): string => {
  const { repoPath, args: gitArgs, timeoutMs } = args;
  return execFileSync('git', gitArgs, {
    cwd: repoPath,
    env: applyGitEnv(),
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: timeoutMs ?? undefined,
  }).toString();
};

const tryRunGit = (args: {
  repoPath: string;
  args: string[];
  timeoutMs?: number | null;
}): { ok: true; stdout: string } | { ok: false } => {
  try {
    return { ok: true, stdout: runGit(args) };
  } catch {
    return { ok: false };
  }
};

const isEmptyDirectory = (args: { dirPath: string }): boolean => {
  const { dirPath } = args;
  return readdirSync(dirPath).length === 0;
};

const validateTargetIsApplicable = (args: { repoPath: string }): void => {
  const { repoPath } = args;
  if (!existsSync(repoPath)) return;

  const stat = statSync(repoPath);
  if (!stat.isDirectory()) {
    const err: ErrorInput = {
      type: 'target_not_empty',
      message: `${repoPath} exists and is not a directory`,
    };
    throw err;
  }
  if (!isEmptyDirectory({ dirPath: repoPath })) {
    const err: ErrorInput = {
      type: 'target_not_empty',
      message: `${repoPath} is not empty`,
    };
    throw err;
  }
};

export interface ApplyCheckpointResult {
  repoSha: string;
  branch: string;
}

export const applyCheckpointBundle = (args: {
  repoPath: string;
  bundlePath: string;
  expectedSha256?: string | null;
  perCommandTimeoutMs?: number | null;
}): ApplyCheckpointResult => {
  const { repoPath, bundlePath } = args;
  const expectedSha256 = args.expectedSha256 ?? null;
  const perCommandTimeoutMs = args.perCommandTimeoutMs ?? 15_000;

  if (!existsSync(bundlePath)) {
    const err: ErrorInput = {
      type: 'bundle_not_found',
      message: `Bundle file ${bundlePath} does not exist`,
    };
    throw err;
  }
  const bundleStat = statSync(bundlePath);
  if (!bundleStat.isFile()) {
    const err: ErrorInput = {
      type: 'bundle_not_found',
      message: `Bundle path ${bundlePath} is not a regular file`,
    };
    throw err;
  }

  if (expectedSha256 != null) {
    if (!SHA256_HEX.test(expectedSha256)) {
      const err: ErrorInput = {
        type: 'bundle_sha_mismatch',
        message: `--expected-sha256 must be 64 hex chars, got '${expectedSha256}'`,
      };
      throw err;
    }
    const bundleBytes = readFileSync(bundlePath);
    const actual = createHash('sha256').update(bundleBytes).digest('hex');
    if (actual.toLowerCase() !== expectedSha256.toLowerCase()) {
      const err: ErrorInput = {
        type: 'bundle_sha_mismatch',
        message: `Bundle sha256 mismatch: expected ${expectedSha256}, got ${actual}`,
      };
      throw err;
    }
  }

  validateTargetIsApplicable({ repoPath });

  if (!existsSync(repoPath)) {
    mkdirSync(repoPath, { recursive: true });
  }

  runGit({
    repoPath,
    args: ['init', '-b', DEFAULT_BRANCH],
    timeoutMs: perCommandTimeoutMs,
  });

  const fetchResult = tryRunGit({
    repoPath,
    args: [
      'fetch',
      bundlePath,
      'refs/nori-checkpoint/*:refs/nori-checkpoint/*',
    ],
    timeoutMs: perCommandTimeoutMs,
  });
  if (fetchResult.ok === false) {
    const err: ErrorInput = {
      type: 'invalid_bundle',
      message: `git fetch from bundle ${bundlePath} failed`,
    };
    throw err;
  }

  const refsList = runGit({
    repoPath,
    args: [
      'for-each-ref',
      '--format=%(refname) %(objectname)',
      'refs/nori-checkpoint/',
    ],
    timeoutMs: perCommandTimeoutMs,
  })
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (refsList.length === 0) {
    const err: ErrorInput = {
      type: 'invalid_bundle',
      message: `Bundle at ${bundlePath} contains no refs/nori-checkpoint/ refs`,
    };
    throw err;
  }
  const firstParts = refsList[0]!.split(' ');
  const repoSha = firstParts[1]!;

  runGit({
    repoPath,
    args: ['update-ref', `refs/heads/${DEFAULT_BRANCH}`, repoSha],
    timeoutMs: perCommandTimeoutMs,
  });
  runGit({
    repoPath,
    args: ['symbolic-ref', 'HEAD', `refs/heads/${DEFAULT_BRANCH}`],
    timeoutMs: perCommandTimeoutMs,
  });
  runGit({
    repoPath,
    args: ['reset', '--hard', `refs/heads/${DEFAULT_BRANCH}`],
    timeoutMs: perCommandTimeoutMs,
  });

  for (const line of refsList) {
    const refName = line.split(' ')[0]!;
    tryRunGit({
      repoPath,
      args: ['update-ref', '-d', refName],
      timeoutMs: perCommandTimeoutMs,
    });
  }

  return { repoSha, branch: DEFAULT_BRANCH };
};
