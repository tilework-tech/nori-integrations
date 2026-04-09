import { describe, it, expect, beforeAll } from 'vitest';
import { execFile, type ExecFileException } from 'node:child_process';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const PROJECT_DIR = path.resolve(import.meta.dirname, '..');

function runCommand(
  cmd: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      {
        env: { ...process.env, ...env },
        timeout: 30_000,
        cwd: PROJECT_DIR,
      },
      (err: ExecFileException | null, stdout: string, stderr: string) => {
        resolve({ stdout, stderr, exitCode: err?.code as number ?? 0 });
      },
    );
  });
}

describe('build', () => {
  beforeAll(async () => {
    const result = await runCommand('npx', ['tsc']);
    if (result.exitCode !== 0) {
      throw new Error(`tsc failed:\n${result.stderr}\n${result.stdout}`);
    }
  }, 30_000);

  it('compiled dist/index.js exists and is executable', async () => {
    const { stdout, exitCode } = await runCommand('node', [
      path.join(PROJECT_DIR, 'dist/index.js'),
      '--version',
    ]);
    const pkg = JSON.parse(readFileSync(path.join(PROJECT_DIR, 'package.json'), 'utf-8'));
    expect(stdout.trim()).toBe(pkg.version);
  });

  it('compiled CLI shows help when run with no args', async () => {
    const { stderr, exitCode } = await runCommand(
      'node',
      [path.join(PROJECT_DIR, 'dist/index.js')],
      { NORI_BROKER_URL: '', NORI_BROKER_TOKEN: '' },
    );
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('nori-broker');
  });

  it('compiled CLI health command works against test server', async () => {
    // Import http to create a quick test server
    const http = await import('node:http');
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"status":"ok"}');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    try {
      const { stdout, exitCode } = await runCommand(
        'node',
        [path.join(PROJECT_DIR, 'dist/index.js'), 'health'],
        { NORI_BROKER_URL: `http://127.0.0.1:${port}` },
      );
      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout).status).toBe('ok');
    } finally {
      server.close();
    }
  });
});
