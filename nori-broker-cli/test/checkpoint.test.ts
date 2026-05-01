import { describe, it, expect, afterEach } from 'vitest';
import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import path from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import busboy from 'busboy';

const CLI_PATH = path.resolve(import.meta.dirname, '../src/index.ts');
const CLI_CWD = path.resolve(import.meta.dirname, '..');

type CliResult = { stdout: string; stderr: string; exitCode: number };

const runCli = async (args: {
  cliArgs: string[];
  env?: Record<string, string> | null;
  stdin?: string | null;
}): Promise<CliResult> => {
  const env = args.env ?? {};
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', CLI_PATH, ...args.cliArgs], {
      cwd: CLI_CWD,
      env: { ...process.env, ...env },
      stdio: [args.stdin != null ? 'pipe' : 'inherit', 'pipe', 'pipe'],
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
    if (args.stdin != null && child.stdin != null) {
      child.stdin.write(args.stdin);
      child.stdin.end();
    }
  });
};

const startTestServer = (
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>,
): Promise<{ server: Server; port: number }> => {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr != null ? addr.port : 0;
      resolve({ server, port });
    });
  });
};

interface CapturedRequest {
  method: string;
  url: string;
  authorization: string | undefined;
  contentType: string;
  rawBody: Buffer;
}

const captureRequest = (req: IncomingMessage): Promise<CapturedRequest> => {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      resolve({
        method: req.method ?? '',
        url: req.url ?? '',
        authorization: req.headers.authorization,
        contentType: req.headers['content-type'] ?? '',
        rawBody: Buffer.concat(chunks),
      });
    });
  });
};

const setupTempRepo = (args: {
  tracked: Record<string, string>;
  untracked?: Record<string, string>;
  ignored?: Record<string, string>;
}): { repoPath: string; cleanup: () => void } => {
  const repoPath = mkdtempSync(path.join(os.tmpdir(), 'nori-checkpoint-test-'));
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

interface ParsedMultipart {
  metadata: Record<string, unknown>;
  bundle: Buffer;
}

const parseMultipart = (args: {
  body: Buffer;
  contentType: string;
}): Promise<ParsedMultipart> => {
  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: { 'content-type': args.contentType },
      limits: { fileSize: 200 * 1024 * 1024, fields: 8, files: 2 },
    });
    let metadata: Record<string, unknown> | null = null;
    let bundle: Buffer | null = null;
    bb.on('field', (name, value) => {
      if (name === 'metadata') {
        metadata = JSON.parse(value) as Record<string, unknown>;
      }
    });
    bb.on('file', (name, stream) => {
      if (name !== 'bundle') {
        stream.resume();
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => {
        bundle = Buffer.concat(chunks);
      });
      stream.on('error', reject);
    });
    bb.on('error', reject);
    bb.on('close', () => {
      if (metadata == null) {
        reject(new Error('missing metadata part'));
        return;
      }
      if (bundle == null) {
        reject(new Error('missing bundle part'));
        return;
      }
      resolve({ metadata, bundle });
    });
    Readable.from(args.body).pipe(bb);
  });
};

describe('checkpoint create', () => {
  let server: Server | null = null;
  let repoCleanup: (() => void) | null = null;

  afterEach(() => {
    if (server != null) server.close();
    server = null;
    if (repoCleanup != null) repoCleanup();
    repoCleanup = null;
  });

  it('uploads multipart body containing a valid git bundle to /api/checkpoints', async () => {
    const repo = setupTempRepo({
      tracked: { 'README.md': '# initial\n' },
      untracked: { 'src/new-file.ts': 'export const x = 1;\n' },
    });
    repoCleanup = repo.cleanup;

    let captured: CapturedRequest | null = null;
    const started = await startTestServer(async (req, res) => {
      captured = await captureRequest(req);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          bundleS3Key: 'checkpoints/org=o/session=sess-1/turn=turn-1.bundle',
          bundleSha256: 'deadbeef',
          degraded: false,
        }),
      );
    });
    server = started.server;

    const { stdout, exitCode } = await runCli({
      cliArgs: [
        'checkpoint',
        'create',
        '--session-id',
        'sess-1',
        '--turn-id',
        'turn-1',
        '--seq',
        '0',
        '--sprite-name',
        'sprite-a',
        '--repo-path',
        repo.repoPath,
      ],
      env: {
        NORI_BROKER_URL: `http://127.0.0.1:${started.port}`,
        NORI_BROKER_TOKEN: 'tok',
      },
    });

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);

    expect(captured).not.toBeNull();
    const cap = captured!;
    expect(cap.method).toBe('POST');
    expect(cap.url).toBe('/api/checkpoints');
    expect(cap.authorization).toBe('Bearer tok');
    expect(cap.contentType.startsWith('multipart/form-data')).toBe(true);

    const parsed = await parseMultipart({
      body: cap.rawBody,
      contentType: cap.contentType,
    });
    expect(parsed.metadata.sessionId).toBe('sess-1');
    expect(parsed.metadata.turnId).toBe('turn-1');
    expect(parsed.metadata.seq).toBe(0);
    expect(parsed.metadata.spriteName).toBe('sprite-a');
    expect(typeof parsed.metadata.repoSha).toBe('string');
    expect((parsed.metadata.repoSha as string).length).toBeGreaterThan(0);

    const bundlePath = path.join(
      mkdtempSync(path.join(os.tmpdir(), 'nori-bundle-verify-')),
      'received.bundle',
    );
    writeFileSync(bundlePath, parsed.bundle);
    expect(() => {
      execFileSync('git', ['bundle', 'verify', bundlePath], {
        cwd: repo.repoPath,
        stdio: 'ignore',
      });
    }).not.toThrow();

    const restorePath = mkdtempSync(
      path.join(os.tmpdir(), 'nori-bundle-metadata-'),
    );
    execFileSync('git', ['init', '-b', 'main'], { cwd: restorePath });
    execFileSync(
      'git',
      ['fetch', bundlePath, 'refs/nori-checkpoint/*:refs/nori-checkpoint/*'],
      { cwd: restorePath },
    );
    const checkpointSha = execFileSync(
      'git',
      ['rev-parse', 'refs/nori-checkpoint/turn-1'],
      { cwd: restorePath, encoding: 'utf-8' },
    ).trim();
    expect(parsed.metadata.repoSha).toBe(checkpointSha);
  });

  it('captures untracked files and excludes .gitignored files in the bundle', async () => {
    const repo = setupTempRepo({
      tracked: { 'tracked.txt': 'tracked content\n' },
      untracked: { 'untracked.txt': 'untracked content\n' },
      ignored: { 'secrets.env': 'API_KEY=sekrit\n' },
    });
    repoCleanup = repo.cleanup;

    let capturedBundle: Buffer | null = null;
    const started = await startTestServer(async (req, res) => {
      const cap = await captureRequest(req);
      const parsed = await parseMultipart({
        body: cap.rawBody,
        contentType: cap.contentType,
      });
      capturedBundle = parsed.bundle;
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(
        '{"ok":true,"bundleS3Key":"k","bundleSha256":"x","degraded":false}',
      );
    });
    server = started.server;

    const { exitCode } = await runCli({
      cliArgs: [
        'checkpoint',
        'create',
        '--session-id',
        'sess-2',
        '--turn-id',
        'turn-2',
        '--seq',
        '1',
        '--sprite-name',
        'sprite-b',
        '--repo-path',
        repo.repoPath,
      ],
      env: {
        NORI_BROKER_URL: `http://127.0.0.1:${started.port}`,
        NORI_BROKER_TOKEN: 'tok',
      },
    });
    expect(exitCode).toBe(0);
    expect(capturedBundle).not.toBeNull();

    const tmpRestoreDir = mkdtempSync(
      path.join(os.tmpdir(), 'nori-bundle-restore-'),
    );
    const bundleFile = path.join(tmpRestoreDir, 'received.bundle');
    writeFileSync(bundleFile, capturedBundle!);

    const restoreRepo = path.join(tmpRestoreDir, 'restored');
    execFileSync('git', ['init', '-b', 'main', restoreRepo]);
    execFileSync(
      'git',
      ['fetch', bundleFile, 'refs/nori-checkpoint/turn-2:refs/checkpoint'],
      { cwd: restoreRepo },
    );
    const lsTreeOut = execFileSync(
      'git',
      ['ls-tree', '-r', '--name-only', 'refs/checkpoint'],
      { cwd: restoreRepo, encoding: 'utf-8' },
    );
    const files = lsTreeOut.split('\n').filter((f) => f.length > 0);
    expect(files).toContain('tracked.txt');
    expect(files).toContain('untracked.txt');
    expect(files).toContain('.gitignore');
    expect(files).not.toContain('secrets.env');

    rmSync(tmpRestoreDir, { recursive: true, force: true });
  });

  it('does not modify the active branch HEAD or the working tree state', async () => {
    const repo = setupTempRepo({
      tracked: { 'a.txt': 'a\n', 'b.txt': 'b\n' },
    });
    repoCleanup = repo.cleanup;
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: 'Tester',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Tester',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    };

    writeFileSync(path.join(repo.repoPath, 'a.txt'), 'a-modified-staged\n');
    execFileSync('git', ['add', 'a.txt'], { cwd: repo.repoPath, env });
    writeFileSync(path.join(repo.repoPath, 'b.txt'), 'b-modified-unstaged\n');
    writeFileSync(path.join(repo.repoPath, 'c.txt'), 'c-untracked\n');

    const headBefore = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repo.repoPath,
      encoding: 'utf-8',
    }).trim();
    const statusBefore = execFileSync('git', ['status', '--porcelain'], {
      cwd: repo.repoPath,
      encoding: 'utf-8',
    });

    const started = await startTestServer((_req, res) => {
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(
        '{"ok":true,"bundleS3Key":"k","bundleSha256":"x","degraded":false}',
      );
    });
    server = started.server;

    const { exitCode } = await runCli({
      cliArgs: [
        'checkpoint',
        'create',
        '--session-id',
        'sess-3',
        '--turn-id',
        'turn-3',
        '--seq',
        '0',
        '--sprite-name',
        'sprite-c',
        '--repo-path',
        repo.repoPath,
      ],
      env: {
        NORI_BROKER_URL: `http://127.0.0.1:${started.port}`,
        NORI_BROKER_TOKEN: 'tok',
      },
    });
    expect(exitCode).toBe(0);

    const headAfter = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repo.repoPath,
      encoding: 'utf-8',
    }).trim();
    const statusAfter = execFileSync('git', ['status', '--porcelain'], {
      cwd: repo.repoPath,
      encoding: 'utf-8',
    });

    expect(headAfter).toBe(headBefore);
    expect(statusAfter).toBe(statusBefore);

    const refExists = execFileSync(
      'git',
      ['for-each-ref', '--format=%(refname)', 'refs/nori-checkpoint/'],
      { cwd: repo.repoPath, encoding: 'utf-8' },
    );
    expect(refExists.trim()).toBe('');
  });

  it('returns network_error when broker unreachable', async () => {
    const repo = setupTempRepo({ tracked: { 'a.txt': 'a\n' } });
    repoCleanup = repo.cleanup;

    const { stdout, exitCode } = await runCli({
      cliArgs: [
        'checkpoint',
        'create',
        '--session-id',
        'sess-4',
        '--turn-id',
        'turn-4',
        '--seq',
        '0',
        '--sprite-name',
        'sprite-d',
        '--repo-path',
        repo.repoPath,
      ],
      env: {
        NORI_BROKER_URL: 'http://127.0.0.1:1',
        NORI_BROKER_TOKEN: 'tok',
      },
    });
    expect(exitCode).not.toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('network_error');
  });

  it('surfaces broker 503 service_unavailable', async () => {
    const repo = setupTempRepo({ tracked: { 'a.txt': 'a\n' } });
    repoCleanup = repo.cleanup;

    const started = await startTestServer((_req, res) => {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end('{"error":"Checkpoint persistence is not configured"}');
    });
    server = started.server;

    const { stdout, exitCode } = await runCli({
      cliArgs: [
        'checkpoint',
        'create',
        '--session-id',
        'sess-5',
        '--turn-id',
        'turn-5',
        '--seq',
        '0',
        '--sprite-name',
        'sprite-e',
        '--repo-path',
        repo.repoPath,
      ],
      env: {
        NORI_BROKER_URL: `http://127.0.0.1:${started.port}`,
        NORI_BROKER_TOKEN: 'tok',
      },
    });
    expect(exitCode).not.toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('service_unavailable');
  });

  it('surfaces broker 413 payload too large', async () => {
    const repo = setupTempRepo({ tracked: { 'a.txt': 'a\n' } });
    repoCleanup = repo.cleanup;

    const started = await startTestServer((_req, res) => {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end('{"error":"multipart part \'bundle\' exceeded 100 byte limit"}');
    });
    server = started.server;

    const { stdout, exitCode } = await runCli({
      cliArgs: [
        'checkpoint',
        'create',
        '--session-id',
        'sess-6',
        '--turn-id',
        'turn-6',
        '--seq',
        '0',
        '--sprite-name',
        'sprite-f',
        '--repo-path',
        repo.repoPath,
      ],
      env: {
        NORI_BROKER_URL: `http://127.0.0.1:${started.port}`,
        NORI_BROKER_TOKEN: 'tok',
      },
    });
    expect(exitCode).not.toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('http_413');
  });

  it('exits non-zero when --session-id is missing', async () => {
    const repo = setupTempRepo({ tracked: { 'a.txt': 'a\n' } });
    repoCleanup = repo.cleanup;

    const { exitCode } = await runCli({
      cliArgs: [
        'checkpoint',
        'create',
        '--turn-id',
        't',
        '--seq',
        '0',
        '--sprite-name',
        'sprite',
        '--repo-path',
        repo.repoPath,
      ],
      env: {
        NORI_BROKER_URL: 'http://127.0.0.1:1',
        NORI_BROKER_TOKEN: 'tok',
      },
    });
    expect(exitCode).not.toBe(0);
  });

  it('exits with a clear error when --repo-path is not a git repo', async () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'not-a-repo-'));
    try {
      const { stdout, exitCode } = await runCli({
        cliArgs: [
          'checkpoint',
          'create',
          '--session-id',
          'sess-7',
          '--turn-id',
          'turn-7',
          '--seq',
          '0',
          '--sprite-name',
          'sprite-g',
          '--repo-path',
          tmp,
        ],
        env: {
          NORI_BROKER_URL: 'http://127.0.0.1:1',
          NORI_BROKER_TOKEN: 'tok',
        },
      });
      expect(exitCode).not.toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('not_a_git_repo');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('handles a brand-new repo with no commits yet', async () => {
    const repoPath = mkdtempSync(
      path.join(os.tmpdir(), 'nori-checkpoint-no-head-'),
    );
    try {
      execFileSync('git', ['init', '-b', 'main'], { cwd: repoPath });
      writeFileSync(path.join(repoPath, 'hello.txt'), 'hi\n');

      let capturedBundle: Buffer | null = null;
      let capturedMetadata: Record<string, unknown> | null = null;
      const started = await startTestServer(async (req, res) => {
        const cap = await captureRequest(req);
        const parsed = await parseMultipart({
          body: cap.rawBody,
          contentType: cap.contentType,
        });
        capturedBundle = parsed.bundle;
        capturedMetadata = parsed.metadata;
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(
          '{"ok":true,"bundleS3Key":"k","bundleSha256":"x","degraded":false}',
        );
      });
      server = started.server;

      const { exitCode } = await runCli({
        cliArgs: [
          'checkpoint',
          'create',
          '--session-id',
          'sess-8',
          '--turn-id',
          'turn-8',
          '--seq',
          '0',
          '--sprite-name',
          'sprite-h',
          '--repo-path',
          repoPath,
        ],
        env: {
          NORI_BROKER_URL: `http://127.0.0.1:${started.port}`,
          NORI_BROKER_TOKEN: 'tok',
        },
      });
      expect(exitCode).toBe(0);
      expect(capturedBundle).not.toBeNull();
      expect(capturedBundle!.length).toBeGreaterThan(0);
      expect(capturedMetadata).not.toBeNull();
      expect(typeof capturedMetadata!.repoSha).toBe('string');
      expect((capturedMetadata!.repoSha as string).length).toBeGreaterThan(0);
    } finally {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });

  it('rejects --turn-id values that are unsafe as a git ref', async () => {
    const repo = setupTempRepo({ tracked: { 'a.txt': 'a\n' } });
    repoCleanup = repo.cleanup;

    const { stdout, exitCode } = await runCli({
      cliArgs: [
        'checkpoint',
        'create',
        '--session-id',
        'sess-9',
        '--turn-id',
        'bad turn',
        '--seq',
        '0',
        '--sprite-name',
        'sprite-i',
        '--repo-path',
        repo.repoPath,
      ],
      env: {
        NORI_BROKER_URL: 'http://127.0.0.1:1',
        NORI_BROKER_TOKEN: 'tok',
      },
    });
    expect(exitCode).not.toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid_turn_id');
  });
});

describe('checkpoint create help', () => {
  it('lists checkpoint in top-level --help', async () => {
    const { stdout } = await runCli({ cliArgs: ['--help'] });
    expect(stdout).toContain('checkpoint');
  });
});
