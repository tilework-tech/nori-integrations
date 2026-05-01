import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ErrorInput } from '../errors.js';

const CHECKPOINT_AUTHOR_NAME = 'Nori';
const CHECKPOINT_AUTHOR_EMAIL = 'bot@nori.dev';
const TURN_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const NULL_SHA = '0'.repeat(40);

const checkpointGitEnv = (args: {
  gitIndexFile?: string | null;
}): NodeJS.ProcessEnv => {
  const { gitIndexFile } = args;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: CHECKPOINT_AUTHOR_NAME,
    GIT_AUTHOR_EMAIL: CHECKPOINT_AUTHOR_EMAIL,
    GIT_COMMITTER_NAME: CHECKPOINT_AUTHOR_NAME,
    GIT_COMMITTER_EMAIL: CHECKPOINT_AUTHOR_EMAIL,
  };
  if (gitIndexFile != null) env.GIT_INDEX_FILE = gitIndexFile;
  return env;
};

const runGit = (args: {
  repoPath: string;
  gitIndexFile?: string | null;
  args: string[];
  input?: string | null;
  timeoutMs?: number | null;
}): string => {
  const { repoPath, gitIndexFile, args: gitArgs, input, timeoutMs } = args;
  return execFileSync('git', gitArgs, {
    cwd: repoPath,
    env: checkpointGitEnv({ gitIndexFile: gitIndexFile ?? null }),
    encoding: 'utf-8',
    input: input ?? undefined,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: timeoutMs ?? undefined,
  }).toString();
};

const tryRunGit = (args: {
  repoPath: string;
  gitIndexFile?: string | null;
  args: string[];
  timeoutMs?: number | null;
}): { ok: true; stdout: string } | { ok: false } => {
  const { repoPath, gitIndexFile, args: gitArgs, timeoutMs } = args;
  try {
    const stdout = execFileSync('git', gitArgs, {
      cwd: repoPath,
      env: checkpointGitEnv({ gitIndexFile: gitIndexFile ?? null }),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs ?? undefined,
    }).toString();
    return { ok: true, stdout };
  } catch {
    return { ok: false };
  }
};

export interface CheckpointBundle {
  bundlePath: string;
  bundleBytes: Uint8Array;
  bundleSha256: string;
  repoSha: string;
  cleanup: () => void;
}

export const createCheckpointBundle = (args: {
  repoPath: string;
  turnId: string;
  perCommandTimeoutMs?: number | null;
}): CheckpointBundle => {
  const { repoPath, turnId } = args;
  const perCommandTimeoutMs = args.perCommandTimeoutMs ?? 15_000;

  if (!TURN_ID_PATTERN.test(turnId)) {
    const err: ErrorInput = {
      type: 'invalid_turn_id',
      message: `turnId '${turnId}' must match ${TURN_ID_PATTERN}`,
    };
    throw err;
  }

  const insideCheck = tryRunGit({
    repoPath,
    args: ['rev-parse', '--is-inside-work-tree'],
    timeoutMs: perCommandTimeoutMs,
  });
  if (insideCheck.ok === false || insideCheck.stdout.trim() !== 'true') {
    const err: ErrorInput = {
      type: 'not_a_git_repo',
      message: `${repoPath} is not a git working tree`,
    };
    throw err;
  }

  const headProbe = tryRunGit({
    repoPath,
    args: ['rev-parse', '--verify', 'HEAD'],
    timeoutMs: perCommandTimeoutMs,
  });
  const headSha = headProbe.ok ? headProbe.stdout.trim() : '';

  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'nori-checkpoint-'));
  const tmpIndex = path.join(tmpDir, 'index');
  const bundlePath = path.join(
    tmpDir,
    `checkpoint-${turnId}-${randomBytes(4).toString('hex')}.bundle`,
  );
  const tempRefName = `refs/nori-checkpoint/${turnId}`;
  let refCreated = false;

  const cleanup = () => {
    if (refCreated) {
      tryRunGit({
        repoPath,
        args: ['update-ref', '-d', tempRefName],
        timeoutMs: perCommandTimeoutMs,
      });
      refCreated = false;
    }
    rmSync(tmpDir, { recursive: true, force: true });
  };

  try {
    if (headSha.length > 0) {
      runGit({
        repoPath,
        gitIndexFile: tmpIndex,
        args: ['read-tree', headSha],
        timeoutMs: perCommandTimeoutMs,
      });
    }

    runGit({
      repoPath,
      gitIndexFile: tmpIndex,
      args: ['add', '-A'],
      timeoutMs: perCommandTimeoutMs,
    });

    const tree = runGit({
      repoPath,
      gitIndexFile: tmpIndex,
      args: ['write-tree'],
      timeoutMs: perCommandTimeoutMs,
    }).trim();

    const commitArgs = ['commit-tree', tree];
    if (headSha.length > 0) commitArgs.push('-p', headSha);

    const commitSha = runGit({
      repoPath,
      args: commitArgs,
      input: `nori-checkpoint turn=${turnId}\n`,
      timeoutMs: perCommandTimeoutMs,
    }).trim();

    runGit({
      repoPath,
      args: ['update-ref', tempRefName, commitSha],
      timeoutMs: perCommandTimeoutMs,
    });
    refCreated = true;

    runGit({
      repoPath,
      args: ['bundle', 'create', bundlePath, tempRefName],
      timeoutMs: perCommandTimeoutMs,
    });

    const bundleBytes = readFileSync(bundlePath);
    const bundleSha256 = createHash('sha256').update(bundleBytes).digest('hex');

    return {
      bundlePath,
      bundleBytes: new Uint8Array(bundleBytes),
      bundleSha256,
      repoSha: commitSha.length > 0 ? commitSha : NULL_SHA,
      cleanup,
    };
  } catch (err) {
    cleanup();
    throw err;
  }
};
