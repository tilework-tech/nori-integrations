import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(PROJECT_ROOT, 'dist');
const DIST_ENTRY = path.resolve(DIST_DIR, 'index.js');
const pkg = JSON.parse(readFileSync(path.resolve(PROJECT_ROOT, 'package.json'), 'utf-8'));

async function runBuiltCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await exec(
      'node', [DIST_ENTRY, ...args],
      { cwd: PROJECT_ROOT, env: { ...process.env, SLACK_BOT_TOKEN: '' }, timeout: 10000 }
    );
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code ?? 1,
    };
  }
}

describe('Build verification', () => {
  beforeAll(async () => {
    await rm(DIST_DIR, { recursive: true, force: true });
    await exec('npx', ['tsc'], { cwd: PROJECT_ROOT, timeout: 30000 });
  }, 35000);

  it('--version outputs the package version', async () => {
    const result = await runBuiltCli(['--version']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(pkg.version);
  });

  it('list-methods outputs valid JSON with a methods array', async () => {
    const result = await runBuiltCli(['list-methods']);
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(Array.isArray(output.methods)).toBe(true);
    expect(output.methods.length).toBeGreaterThan(0);
  });

  it('exits non-zero with usage help when no arguments provided', async () => {
    const result = await runBuiltCli([]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('method');
  });
});
