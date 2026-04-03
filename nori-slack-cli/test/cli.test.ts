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

  it('describe outputs method metadata for a known method', async () => {
    const result = await runCli(['describe', 'chat.postMessage']);
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.ok).toBe(true);
    expect(output.method).toBe('chat.postMessage');
    expect(output.known).toBe(true);
    expect(output.description).toBeTruthy();
    expect(output.required_params).toHaveProperty('channel');
    expect(output.optional_params).toHaveProperty('text');
    expect(output.docs_url).toContain('chat.postMessage');
  });

  it('describe returns fallback for unknown method', async () => {
    const result = await runCli(['describe', 'fake.unknown']);
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.ok).toBe(true);
    expect(output.method).toBe('fake.unknown');
    expect(output.known).toBe(false);
    expect(output.description).toContain('No detailed documentation');
    expect(output.docs_url).toContain('fake.unknown');
  });

  it('describe shows pagination support for paginated methods', async () => {
    const result = await runCli(['describe', 'conversations.list']);
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.supports_pagination).toBe(true);
  });

  it('describe shows deprecation notice for deprecated methods', async () => {
    const result = await runCli(['describe', 'files.upload']);
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.deprecated).toBeTruthy();
    expect(output.deprecated).toContain('files.getUploadURLExternal');
  });

  it('describe without method argument exits with error', async () => {
    const result = await runCli(['describe']);
    expect(result.exitCode).not.toBe(0);
  });

  it('describe returns known:true for newly-added namespace methods', async () => {
    const methods = ['dnd.setSnooze', 'usergroups.create', 'views.open', 'team.info'];
    for (const method of methods) {
      const result = await runCli(['describe', method]);
      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.ok, `${method} should return ok:true`).toBe(true);
      expect(output.known, `${method} should be known`).toBe(true);
      expect(output.description, `${method} should have a description`).toBeTruthy();
    }
  }, 15000);

  it('list-methods --namespace filters to matching methods only', async () => {
    const result = await runCli(['list-methods', '--namespace', 'chat']);
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.namespace).toBe('chat');
    expect(output.methods.length).toBeGreaterThan(0);
    for (const method of output.methods) {
      expect(method).toMatch(/^chat\./);
    }
    expect(output.methods).toContain('chat.postMessage');
    expect(output.methods).not.toContain('conversations.list');
  });

  it('list-methods --namespace with no matches returns empty array', async () => {
    const result = await runCli(['list-methods', '--namespace', 'nonexistent']);
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.namespace).toBe('nonexistent');
    expect(output.methods).toEqual([]);
  });

  it('list-methods --descriptions includes method descriptions', async () => {
    const result = await runCli(['list-methods', '--descriptions']);
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.methods.length).toBeGreaterThan(10);
    const chatPost = output.methods.find((e: any) => e.method === 'chat.postMessage');
    expect(chatPost).toBeDefined();
    expect(chatPost.description.length).toBeGreaterThan(0);
    const convList = output.methods.find((e: any) => e.method === 'conversations.list');
    expect(convList).toBeDefined();
    expect(convList.description.length).toBeGreaterThan(0);
  });

  it('list-methods --namespace and --descriptions compose together', async () => {
    const result = await runCli(['list-methods', '--namespace', 'conversations', '--descriptions']);
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.namespace).toBe('conversations');
    expect(output.methods.length).toBeGreaterThan(0);
    for (const entry of output.methods) {
      expect(entry.method).toMatch(/^conversations\./);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('--dry-run with misspelled method includes suggestions in output', async () => {
    const result = await runCli(
      ['chat.postmesage', '--dry-run', '--channel', 'C123'],
      { SLACK_BOT_TOKEN: 'xoxb-test-token' }
    );
    expect(result.exitCode).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.dry_run).toBe(true);
    expect(output.warning).toBeDefined();
    expect(output.suggestions).toBeDefined();
    expect(output.suggestions).toContain('chat.postMessage');
  });

  it('misspelled method shows suggestions on stderr before API call', async () => {
    const result = await runCli(
      ['chat.postmesage', '--channel', 'C123', '--text', 'hi'],
      { SLACK_BOT_TOKEN: 'xoxb-fake-token' }
    );
    expect(result.stderr).toContain('Did you mean');
    expect(result.stderr).toContain('chat.postMessage');
  });
});
