import { describe, it, expect } from 'vitest';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, '../src/index.ts');
const PROJECT_ROOT = path.resolve(__dirname, '..');

async function runCli(args: string[], env: Record<string, string> = {}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await exec(
      'npx', ['tsx', CLI_PATH, ...args],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, ...env },
        timeout: 10000,
      }
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

async function runCliWithStdin(args: string[], stdinData: string, env: Record<string, string> = {}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', CLI_PATH, ...args], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
    child.on('close', (code: number | null) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
    child.stdin.write(stdinData);
    child.stdin.end();
  });
}

describe('CLI integration', () => {
  it('exits with non-zero code and shows usage when no method is provided', async () => {
    const result = await runCli([], { SLACK_BOT_TOKEN: 'xoxb-test' });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('method');
  });

  it('exits with structured JSON error when SLACK_BOT_TOKEN is not set', async () => {
    const result = await runCli(['chat.postMessage', '--channel', 'C123'], { SLACK_BOT_TOKEN: '' });
    const output = JSON.parse(result.stdout);
    expect(output.ok).toBe(false);
    expect(output.error).toBe('no_token');
    expect(output.suggestion).toContain('SLACK_BOT_TOKEN');
  });

  it('outputs known method namespaces via list-methods', async () => {
    const result = await runCli(['list-methods'], { SLACK_BOT_TOKEN: 'xoxb-test' });
    const output = JSON.parse(result.stdout);
    expect(output.methods.length).toBeGreaterThan(10);
  });

  it('returns structured error JSON with source path and suggestion on API failure', async () => {
    const result = await runCli(
      ['chat.postMessage', '--channel', 'C123', '--text', 'hello'],
      { SLACK_BOT_TOKEN: 'xoxb-fake-token' }
    );
    const output = JSON.parse(result.stdout);
    expect(output.ok).toBe(false);
    expect(output.error).toBe('invalid_auth');
    expect(output.source).toContain('nori-slack-cli');
    expect(output.suggestion.length).toBeGreaterThan(0);
  });

  it('accepts --paginate flag and returns structured error with fake token', async () => {
    const result = await runCli(
      ['conversations.list', '--paginate'],
      { SLACK_BOT_TOKEN: 'xoxb-fake-token' }
    );
    const output = JSON.parse(result.stdout);
    expect(output.ok).toBe(false);
    expect(output.error).toBe('invalid_auth');
  });

  it('reads JSON from stdin via --json-input and processes it', async () => {
    const jsonInput = JSON.stringify({ channel: 'C123', text: 'from stdin' });
    const result = await runCliWithStdin(
      ['chat.postMessage', '--json-input'],
      jsonInput,
      { SLACK_BOT_TOKEN: 'xoxb-fake-token' }
    );
    const output = JSON.parse(result.stdout);
    expect(output.ok).toBe(false);
    expect(output.error).toBe('invalid_auth');
  });

  it('--dry-run outputs resolved request without calling the API', async () => {
    const result = await runCli(
      ['chat.postMessage', '--dry-run', '--channel', 'C123', '--text', 'hello'],
      { SLACK_BOT_TOKEN: 'xoxb-test-token' }
    );
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.ok).toBe(true);
    expect(output.dry_run).toBe(true);
    expect(output.method).toBe('chat.postMessage');
    expect(output.params.channel).toBe('C123');
    expect(output.params.text).toBe('hello');
    expect(output.token_present).toBe(true);
  });

  it('--dry-run without token exits 0 and reports token_present false', async () => {
    const result = await runCli(
      ['chat.postMessage', '--dry-run', '--channel', 'C123'],
      { SLACK_BOT_TOKEN: '' }
    );
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.dry_run).toBe(true);
    expect(output.token_present).toBe(false);
  });

  it('--dry-run warns on unknown method', async () => {
    const result = await runCli(
      ['fake.unknownMethod', '--dry-run', '--foo', 'bar'],
      { SLACK_BOT_TOKEN: 'xoxb-test-token' }
    );
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.dry_run).toBe(true);
    expect(output.method).toBe('fake.unknownMethod');
    expect(output.warning).toBeDefined();
    expect(output.warning).toContain('not in the known methods list');
  });

  it('--dry-run with --paginate reports paginate true', async () => {
    const result = await runCli(
      ['conversations.list', '--dry-run', '--paginate', '--limit', '50'],
      { SLACK_BOT_TOKEN: 'xoxb-test-token' }
    );
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.dry_run).toBe(true);
    expect(output.paginate).toBe(true);
    expect(output.params.limit).toBe(50);
  });

  it('--dry-run with --json-input merges stdin params', async () => {
    const jsonInput = JSON.stringify({ channel: 'C123', text: 'from stdin' });
    const result = await runCliWithStdin(
      ['chat.postMessage', '--dry-run', '--json-input', '--thread-ts', '123.456'],
      jsonInput,
      { SLACK_BOT_TOKEN: 'xoxb-test-token' }
    );
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.dry_run).toBe(true);
    expect(output.params.channel).toBe('C123');
    expect(output.params.text).toBe('from stdin');
    expect(output.params.thread_ts).toBe('123.456');
  });
});
