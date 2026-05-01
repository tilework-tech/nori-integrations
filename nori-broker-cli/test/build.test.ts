import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const CLI_CWD = path.resolve(import.meta.dirname, '..');
const BUILT_ENTRY = path.join(CLI_CWD, 'dist', 'index.js');

const runBuilt = async (args: {
  cliArgs: string[];
}): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [BUILT_ENTRY, ...args.cliArgs], {
      cwd: CLI_CWD,
      stdio: ['ignore', 'pipe', 'pipe'],
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

describe('npm build', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'build'], {
      cwd: CLI_CWD,
      stdio: 'inherit',
    });
  }, 120_000);

  it('produces a runnable entry at dist/index.js', () => {
    expect(existsSync(BUILT_ENTRY)).toBe(true);
  });

  it('built entry prints version when run with --version', async () => {
    const { stdout, exitCode } = await runBuilt({ cliArgs: ['--version'] });
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('built entry exits non-zero with help on stderr when invoked with no args', async () => {
    const { stderr, exitCode } = await runBuilt({ cliArgs: [] });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('nori-broker');
  });
});
