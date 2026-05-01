import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCheckpointBundle } from '../src/checkpoint/bundle.js';

const CLI_PATH = path.resolve(import.meta.dirname, '../src/index.ts');
const CLI_CWD = path.resolve(import.meta.dirname, '..');

type CliResult = { stdout: string; stderr: string; exitCode: number };

const runCli = async (args: { cliArgs: string[] }): Promise<CliResult> => {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', CLI_PATH, ...args.cliArgs], {
      cwd: CLI_CWD,
      env: { ...process.env },
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr.on('data', (c: Buffer) => {
      stderr += c.toString();
    });
    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
};

const setupTempRepo = (args: {
  tracked: Record<string, string>;
  untracked?: Record<string, string>;
  ignored?: Record<string, string>;
}): { repoPath: string; cleanup: () => void } => {
  const repoPath = mkdtempSync(
    path.join(os.tmpdir(), 'nori-checkpoint-apply-src-'),
  );
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Tester',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Tester',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  };
  execFileSync('git', ['init', '-b', 'main'], { cwd: repoPath, env });

  const writeFiles = (files: Record<string, string>) => {
    for (const [rel, content] of Object.entries(files)) {
      const abs = path.join(repoPath, rel);
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, content);
    }
  };

  if (args.ignored != null) {
    const lines = Object.keys(args.ignored).join('\n');
    writeFileSync(path.join(repoPath, '.gitignore'), `${lines}\n`);
  }

  writeFiles(args.tracked);
  execFileSync('git', ['add', '-A'], { cwd: repoPath, env });
  execFileSync('git', ['commit', '-m', 'initial'], { cwd: repoPath, env });

  if (args.untracked != null) writeFiles(args.untracked);
  if (args.ignored != null) writeFiles(args.ignored);

  return {
    repoPath,
    cleanup: () => rmSync(repoPath, { recursive: true, force: true }),
  };
};

const makeBundleFromRepo = (args: {
  repoPath: string;
  turnId: string;
}): {
  bundlePath: string;
  bundleSha256: string;
  bundleBytes: Uint8Array;
  cleanup: () => void;
} => {
  const result = createCheckpointBundle({
    repoPath: args.repoPath,
    turnId: args.turnId,
  });
  return {
    bundlePath: result.bundlePath,
    bundleSha256: result.bundleSha256,
    bundleBytes: result.bundleBytes,
    cleanup: result.cleanup,
  };
};

describe('checkpoint apply', () => {
  let cleanups: Array<() => void> = [];

  afterEach(() => {
    for (const c of cleanups.splice(0)) {
      try {
        c();
      } catch {}
    }
  });

  it('applies a bundle into an empty target and reproduces tracked + untracked files', async () => {
    const src = setupTempRepo({
      tracked: { 'README.md': '# initial\n' },
      untracked: { 'src/new-file.ts': 'export const x = 1;\n' },
      ignored: { 'secrets.env': 'API_KEY=sekrit\n' },
    });
    cleanups.push(src.cleanup);

    const bundle = makeBundleFromRepo({
      repoPath: src.repoPath,
      turnId: 'turn-1',
    });
    cleanups.push(bundle.cleanup);

    const targetParent = mkdtempSync(
      path.join(os.tmpdir(), 'nori-checkpoint-apply-dst-'),
    );
    cleanups.push(() => rmSync(targetParent, { recursive: true, force: true }));
    const targetPath = path.join(targetParent, 'workspace');

    const { stdout, exitCode } = await runCli({
      cliArgs: [
        'checkpoint',
        'apply',
        '--repo-path',
        targetPath,
        '--bundle-path',
        bundle.bundlePath,
      ],
    });

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(typeof result.repoSha).toBe('string');
    expect((result.repoSha as string).length).toBeGreaterThan(0);
    expect(result.branch).toBe('main');

    const head = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: targetPath,
      encoding: 'utf-8',
    }).trim();
    expect(head).toBe(result.repoSha);

    const symbolic = execFileSync('git', ['symbolic-ref', 'HEAD'], {
      cwd: targetPath,
      encoding: 'utf-8',
    }).trim();
    expect(symbolic).toBe('refs/heads/main');

    expect(readFileSync(path.join(targetPath, 'README.md'), 'utf-8')).toBe(
      '# initial\n',
    );
    expect(
      readFileSync(path.join(targetPath, 'src/new-file.ts'), 'utf-8'),
    ).toBe('export const x = 1;\n');

    let secretsExists = false;
    try {
      readFileSync(path.join(targetPath, 'secrets.env'));
      secretsExists = true;
    } catch {
      secretsExists = false;
    }
    expect(secretsExists).toBe(false);

    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: targetPath,
      encoding: 'utf-8',
    });
    expect(status).toBe('');

    const tempRefs = execFileSync(
      'git',
      ['for-each-ref', '--format=%(refname)', 'refs/nori-checkpoint/'],
      { cwd: targetPath, encoding: 'utf-8' },
    );
    expect(tempRefs.trim()).toBe('');
  });

  it('rejects --expected-sha256 mismatch and does not create the target directory', async () => {
    const src = setupTempRepo({ tracked: { 'a.txt': 'a\n' } });
    cleanups.push(src.cleanup);
    const bundle = makeBundleFromRepo({
      repoPath: src.repoPath,
      turnId: 'turn-x',
    });
    cleanups.push(bundle.cleanup);

    const targetParent = mkdtempSync(
      path.join(os.tmpdir(), 'nori-checkpoint-apply-dst-'),
    );
    cleanups.push(() => rmSync(targetParent, { recursive: true, force: true }));
    const targetPath = path.join(targetParent, 'workspace');

    const wrongSha = '0'.repeat(64);
    const { stdout, exitCode } = await runCli({
      cliArgs: [
        'checkpoint',
        'apply',
        '--repo-path',
        targetPath,
        '--bundle-path',
        bundle.bundlePath,
        '--expected-sha256',
        wrongSha,
      ],
    });

    expect(exitCode).not.toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('bundle_sha_mismatch');

    let targetCreated = false;
    try {
      execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: targetPath,
        encoding: 'utf-8',
      });
      targetCreated = true;
    } catch {
      targetCreated = false;
    }
    expect(targetCreated).toBe(false);
  });

  it('passes when --expected-sha256 matches the bundle bytes', async () => {
    const src = setupTempRepo({ tracked: { 'a.txt': 'a\n' } });
    cleanups.push(src.cleanup);
    const bundle = makeBundleFromRepo({
      repoPath: src.repoPath,
      turnId: 'turn-ok',
    });
    cleanups.push(bundle.cleanup);

    const expectedSha = createHash('sha256')
      .update(bundle.bundleBytes)
      .digest('hex');

    const targetParent = mkdtempSync(
      path.join(os.tmpdir(), 'nori-checkpoint-apply-dst-'),
    );
    cleanups.push(() => rmSync(targetParent, { recursive: true, force: true }));
    const targetPath = path.join(targetParent, 'workspace');

    const { stdout, exitCode } = await runCli({
      cliArgs: [
        'checkpoint',
        'apply',
        '--repo-path',
        targetPath,
        '--bundle-path',
        bundle.bundlePath,
        '--expected-sha256',
        expectedSha,
      ],
    });

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
  });

  it('refuses to apply onto a directory that is already a non-empty git repo', async () => {
    const src = setupTempRepo({ tracked: { 'a.txt': 'a\n' } });
    cleanups.push(src.cleanup);
    const bundle = makeBundleFromRepo({
      repoPath: src.repoPath,
      turnId: 'turn-conflict',
    });
    cleanups.push(bundle.cleanup);

    const existing = setupTempRepo({ tracked: { 'preexisting.txt': 'p\n' } });
    cleanups.push(existing.cleanup);

    const headBefore = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: existing.repoPath,
      encoding: 'utf-8',
    }).trim();

    const { stdout, exitCode } = await runCli({
      cliArgs: [
        'checkpoint',
        'apply',
        '--repo-path',
        existing.repoPath,
        '--bundle-path',
        bundle.bundlePath,
      ],
    });

    expect(exitCode).not.toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('target_not_empty');

    const headAfter = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: existing.repoPath,
      encoding: 'utf-8',
    }).trim();
    expect(headAfter).toBe(headBefore);
  });

  it('errors when --bundle-path does not exist', async () => {
    const targetParent = mkdtempSync(
      path.join(os.tmpdir(), 'nori-checkpoint-apply-dst-'),
    );
    cleanups.push(() => rmSync(targetParent, { recursive: true, force: true }));
    const targetPath = path.join(targetParent, 'workspace');
    const missingBundle = path.join(targetParent, 'does-not-exist.bundle');

    const { stdout, exitCode } = await runCli({
      cliArgs: [
        'checkpoint',
        'apply',
        '--repo-path',
        targetPath,
        '--bundle-path',
        missingBundle,
      ],
    });

    expect(exitCode).not.toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('bundle_not_found');
  });

  it('errors when --bundle-path is not a valid git bundle', async () => {
    const tmp = mkdtempSync(
      path.join(os.tmpdir(), 'nori-checkpoint-apply-bad-'),
    );
    cleanups.push(() => rmSync(tmp, { recursive: true, force: true }));
    const garbageBundle = path.join(tmp, 'not-a-bundle.bundle');
    writeFileSync(garbageBundle, 'this is not a git bundle\n');

    const targetParent = mkdtempSync(
      path.join(os.tmpdir(), 'nori-checkpoint-apply-dst-'),
    );
    cleanups.push(() => rmSync(targetParent, { recursive: true, force: true }));
    const targetPath = path.join(targetParent, 'workspace');

    const { stdout, exitCode } = await runCli({
      cliArgs: [
        'checkpoint',
        'apply',
        '--repo-path',
        targetPath,
        '--bundle-path',
        garbageBundle,
      ],
    });

    expect(exitCode).not.toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid_bundle');
  });

  it('exits non-zero when --repo-path is missing', async () => {
    const { exitCode } = await runCli({
      cliArgs: ['checkpoint', 'apply', '--bundle-path', '/tmp/whatever.bundle'],
    });
    expect(exitCode).not.toBe(0);
  });
});

describe('checkpoint apply help', () => {
  it('lists apply under checkpoint --help', async () => {
    const { stdout } = await runCli({ cliArgs: ['checkpoint', '--help'] });
    expect(stdout).toContain('apply');
  });
});
