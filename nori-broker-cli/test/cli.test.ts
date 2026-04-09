import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { execFile, type ExecFileException } from 'node:child_process';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';

const CLI_PATH = path.resolve(import.meta.dirname, '../src/index.ts');

function runCli(
  args: string[],
  env: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    execFile(
      'npx',
      ['tsx', CLI_PATH, ...args],
      {
        env: { ...process.env, ...env },
        timeout: 10_000,
        cwd: path.resolve(import.meta.dirname, '..'),
      },
      (err: ExecFileException | null, stdout: string, stderr: string) => {
        resolve({ stdout, stderr, exitCode: err?.code as number ?? 0 });
      },
    );
  });
}

function runCliWithStdin(
  args: string[],
  stdinData: string,
  env: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', CLI_PATH, ...args], {
      env: { ...process.env, ...env },
      cwd: path.resolve(import.meta.dirname, '..'),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d));
    child.stderr.on('data', (d: Buffer) => (stderr += d));
    child.on('close', (code: number | null) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
    child.stdin.write(stdinData);
    child.stdin.end();
  });
}

function startTestServer(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

function collectBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

describe('CLI integration', () => {
  // --- No args / help ---
  it('exits with code 2 and shows help when no args given', async () => {
    const { stderr, exitCode } = await runCli([]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('nori-broker');
  });

  it('shows help with --help flag', async () => {
    const { stdout } = await runCli(['--help']);
    expect(stdout).toContain('nori-broker');
    expect(stdout).toContain('sessions');
    expect(stdout).toContain('fleet');
    expect(stdout).toContain('triggers');
  });

  it('shows version with --version flag', async () => {
    const { stdout } = await runCli(['--version']);
    const pkg = JSON.parse((await import('node:fs')).readFileSync(path.resolve(import.meta.dirname, '../package.json'), 'utf-8'));
    expect(stdout.trim()).toBe(pkg.version);
  });

  // --- health command ---
  describe('health', () => {
    it('returns health status from broker', async () => {
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      });
      try {
        const { stdout, exitCode } = await runCli(['health'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
        });
        expect(exitCode).toBe(0);
        const result = JSON.parse(stdout);
        expect(result.status).toBe('ok');
      } finally {
        server.close();
      }
    });

    it('exits with error when broker URL not set', async () => {
      const { stdout, exitCode } = await runCli(['health'], {
        NORI_BROKER_URL: '',
        NORI_BROKER_TOKEN: '',
      });
      expect(exitCode).not.toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('no_broker_url');
      expect(result.suggestion).toContain('NORI_BROKER_URL');
    });

    it('exits with network error when broker unreachable', async () => {
      const { stdout, exitCode } = await runCli(['health'], {
        NORI_BROKER_URL: 'http://127.0.0.1:1',
      });
      expect(exitCode).not.toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('network_error');
    });
  });

  // --- sessions commands ---
  describe('sessions', () => {
    it('sessions list requires token', async () => {
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      });
      try {
        const { stdout, exitCode } = await runCli(['sessions', 'list'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: '',
        });
        expect(exitCode).not.toBe(0);
        const result = JSON.parse(stdout);
        expect(result.ok).toBe(false);
        expect(result.error).toBe('no_token');
      } finally {
        server.close();
      }
    });

    it('sessions list returns agents from broker', async () => {
      const agents = [{ name: 's1', lifecycle: 'ready' }];
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ agents }));
      });
      try {
        const { stdout, exitCode } = await runCli(['sessions', 'list'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        const result = JSON.parse(stdout);
        expect(result.agents).toEqual(agents);
      } finally {
        server.close();
      }
    });

    it('sessions acquire returns url and sessionId', async () => {
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ url: 'http://sprite.example', sessionId: 's1' }));
      });
      try {
        const { stdout, exitCode } = await runCli(['sessions', 'acquire'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        const result = JSON.parse(stdout);
        expect(result.url).toBe('http://sprite.example');
        expect(result.sessionId).toBe('s1');
      } finally {
        server.close();
      }
    });

    it('sessions release sends sessionId in body', async () => {
      let body = '';
      const { server, port } = await startTestServer(async (req, res) => {
        body = await collectBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { stdout, exitCode } = await runCli(
          ['sessions', 'release', '--session-id', 'sess-123'],
          {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        );
        expect(exitCode).toBe(0);
        expect(JSON.parse(body).sessionId).toBe('sess-123');
      } finally {
        server.close();
      }
    });

    it('sessions release requires --session-id', async () => {
      const { stderr, exitCode } = await runCli(['sessions', 'release'], {
        NORI_BROKER_URL: 'http://127.0.0.1:1',
        NORI_BROKER_TOKEN: 'test-tok',
      });
      expect(exitCode).not.toBe(0);
    });

    it('sessions start sends POST to correct path', async () => {
      let receivedUrl = '';
      const { server, port } = await startTestServer((req, res) => {
        receivedUrl = req.url || '';
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli(['sessions', 'start', '--id', 'agent-1'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(receivedUrl).toBe('/api/sessions/agent-1/start');
      } finally {
        server.close();
      }
    });

    it('sessions restart sends POST to correct path', async () => {
      let receivedUrl = '';
      const { server, port } = await startTestServer((req, res) => {
        receivedUrl = req.url || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli(['sessions', 'restart', '--id', 'agent-1'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(receivedUrl).toBe('/api/sessions/agent-1/restart');
      } finally {
        server.close();
      }
    });

    it('sessions destroy sends POST to correct path', async () => {
      let receivedUrl = '';
      const { server, port } = await startTestServer((req, res) => {
        receivedUrl = req.url || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli(['sessions', 'destroy', '--id', 'agent-1'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(receivedUrl).toBe('/api/sessions/agent-1/destroy');
      } finally {
        server.close();
      }
    });
  });

  // --- fleet commands ---
  describe('fleet', () => {
    it('fleet status does not require token', async () => {
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ total: 5, running: 3, warm: 1, cold: 1, other: 0 }));
      });
      try {
        const { stdout, exitCode } = await runCli(['fleet', 'status'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: '',
        });
        expect(exitCode).toBe(0);
        const result = JSON.parse(stdout);
        expect(result.total).toBe(5);
      } finally {
        server.close();
      }
    });

    it('fleet set-size sends PUT with fleetSize', async () => {
      let body = '';
      let method = '';
      const { server, port } = await startTestServer(async (req, res) => {
        method = req.method || '';
        body = await collectBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"fleetSize":10}');
      });
      try {
        const { stdout, exitCode } = await runCli(['fleet', 'set-size', '--size', '10'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(method).toBe('PUT');
        expect(JSON.parse(body).fleetSize).toBe(10);
      } finally {
        server.close();
      }
    });

    it('fleet get-settings returns settings', async () => {
      const settings = { fleetSize: 5, readyMaxAgeMs: 3600000, sessionInactivityMs: 300000, claimedIdleTimeoutMs: null };
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(settings));
      });
      try {
        const { stdout, exitCode } = await runCli(['fleet', 'get-settings'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(JSON.parse(stdout)).toEqual(settings);
      } finally {
        server.close();
      }
    });

    it('fleet set-settings sends PUT with provided fields', async () => {
      let body = '';
      const { server, port } = await startTestServer(async (req, res) => {
        body = await collectBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      });
      try {
        const { exitCode } = await runCli(
          ['fleet', 'set-settings', '--session-inactivity-ms', '60000'],
          {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        );
        expect(exitCode).toBe(0);
        expect(JSON.parse(body).sessionInactivityMs).toBe(60000);
      } finally {
        server.close();
      }
    });

    it('fleet restart sends POST', async () => {
      let method = '';
      let url = '';
      const { server, port } = await startTestServer((req, res) => {
        method = req.method || '';
        url = req.url || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli(['fleet', 'restart'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(method).toBe('POST');
        expect(url).toBe('/api/fleet/restart');
      } finally {
        server.close();
      }
    });

    it('fleet get-setup returns orgScript and toolshedRepoUrl', async () => {
      const setup = { orgScript: 'echo hi', toolshedRepoUrl: 'https://github.com/x/y.git' };
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(setup));
      });
      try {
        const { stdout, exitCode } = await runCli(['fleet', 'get-setup'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(JSON.parse(stdout)).toEqual(setup);
      } finally {
        server.close();
      }
    });

    it('fleet set-setup sends PUT with provided fields', async () => {
      let body = '';
      const { server, port } = await startTestServer(async (req, res) => {
        body = await collectBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      });
      try {
        const { exitCode } = await runCli(
          ['fleet', 'set-setup', '--toolshed-repo-url', 'https://github.com/x/y.git'],
          {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        );
        expect(exitCode).toBe(0);
        expect(JSON.parse(body).toolshedRepoUrl).toBe('https://github.com/x/y.git');
      } finally {
        server.close();
      }
    });
  });

  // --- scripts commands ---
  describe('scripts', () => {
    it('scripts list returns versions', async () => {
      const versions = [{ id: 'v1', scriptType: 'setup', content: '#!/bin/bash', savedAt: '2024-01-01' }];
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ versions }));
      });
      try {
        const { stdout, exitCode } = await runCli(['scripts', 'list'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(JSON.parse(stdout).versions).toEqual(versions);
      } finally {
        server.close();
      }
    });

    it('scripts get returns a single version', async () => {
      let receivedUrl = '';
      const version = { id: 'v1', scriptType: 'setup', content: '#!/bin/bash', savedAt: '2024-01-01' };
      const { server, port } = await startTestServer((req, res) => {
        receivedUrl = req.url || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(version));
      });
      try {
        const { stdout, exitCode } = await runCli(['scripts', 'get', '--id', 'v1'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(receivedUrl).toBe('/api/scripts/versions/v1');
        expect(JSON.parse(stdout)).toEqual(version);
      } finally {
        server.close();
      }
    });
  });

  // --- notifications commands ---
  describe('notifications', () => {
    it('notifications list returns notifications', async () => {
      const notifications = [{ id: 'n1', type: 'info', message: 'hello' }];
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ notifications }));
      });
      try {
        const { stdout, exitCode } = await runCli(['notifications', 'list'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(JSON.parse(stdout).notifications).toEqual(notifications);
      } finally {
        server.close();
      }
    });

    it('notifications list passes query params', async () => {
      let receivedUrl = '';
      const { server, port } = await startTestServer((req, res) => {
        receivedUrl = req.url || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"notifications":[]}');
      });
      try {
        await runCli(
          ['notifications', 'list', '--category', 'alert', '--source-id', 'src1'],
          {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        );
        expect(receivedUrl).toContain('category=alert');
        expect(receivedUrl).toContain('sourceId=src1');
      } finally {
        server.close();
      }
    });

    it('notifications dismiss sends POST to correct path', async () => {
      let receivedUrl = '';
      const { server, port } = await startTestServer((req, res) => {
        receivedUrl = req.url || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli(['notifications', 'dismiss', '--id', 'n1'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(receivedUrl).toBe('/api/notifications/n1/dismiss');
      } finally {
        server.close();
      }
    });

    it('notifications dismiss-all sends POST', async () => {
      let receivedUrl = '';
      const { server, port } = await startTestServer((req, res) => {
        receivedUrl = req.url || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true,"dismissed":5}');
      });
      try {
        const { exitCode } = await runCli(['notifications', 'dismiss-all'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(receivedUrl).toBe('/api/notifications/dismiss-all');
      } finally {
        server.close();
      }
    });

    it('notifications dismiss-by-category sends category in body', async () => {
      let body = '';
      const { server, port } = await startTestServer(async (req, res) => {
        body = await collectBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true,"dismissed":3}');
      });
      try {
        const { exitCode } = await runCli(
          ['notifications', 'dismiss-by-category', '--category', 'alert'],
          {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        );
        expect(exitCode).toBe(0);
        expect(JSON.parse(body).category).toBe('alert');
      } finally {
        server.close();
      }
    });
  });

  // --- integrations commands ---
  describe('integrations', () => {
    it('integrations set-slack sends PUT with provided fields', async () => {
      let body = '';
      let url = '';
      const { server, port } = await startTestServer(async (req, res) => {
        url = req.url || '';
        body = await collectBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli(
          ['integrations', 'set-slack', '--bot-token', 'xoxb-123', '--mode', 'socket'],
          {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        );
        expect(exitCode).toBe(0);
        expect(url).toBe('/api/integrations/slack');
        const parsed = JSON.parse(body);
        expect(parsed.botToken).toBe('xoxb-123');
        expect(parsed.mode).toBe('socket');
      } finally {
        server.close();
      }
    });

    it('integrations set-github sends PUT', async () => {
      let url = '';
      const { server, port } = await startTestServer(async (req, res) => {
        url = req.url || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli(
          ['integrations', 'set-github', '--app-id', 'app123', '--installation-id', 'inst456'],
          {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        );
        expect(exitCode).toBe(0);
        expect(url).toBe('/api/integrations/github');
      } finally {
        server.close();
      }
    });

    it('integrations set-claude sends PUT', async () => {
      let body = '';
      const { server, port } = await startTestServer(async (req, res) => {
        body = await collectBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli(
          ['integrations', 'set-claude', '--type', 'api-key', '--api-key', 'sk-ant-xxx'],
          {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        );
        expect(exitCode).toBe(0);
        const parsed = JSON.parse(body);
        expect(parsed.type).toBe('api-key');
        expect(parsed.apiKey).toBe('sk-ant-xxx');
      } finally {
        server.close();
      }
    });

    it('integrations set-custom sends key and value', async () => {
      let body = '';
      const { server, port } = await startTestServer(async (req, res) => {
        body = await collectBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli(
          ['integrations', 'set-custom', '--key', 'MY_VAR', '--value', 'my_val'],
          {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        );
        expect(exitCode).toBe(0);
        const parsed = JSON.parse(body);
        expect(parsed.key).toBe('MY_VAR');
        expect(parsed.value).toBe('my_val');
      } finally {
        server.close();
      }
    });

    it('integrations list-custom returns entries', async () => {
      const entries = [{ key: 'A', value: '••••••••' }];
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ entries }));
      });
      try {
        const { stdout, exitCode } = await runCli(['integrations', 'list-custom'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(JSON.parse(stdout).entries).toEqual(entries);
      } finally {
        server.close();
      }
    });

    it('integrations delete-custom sends DELETE to correct path', async () => {
      let receivedUrl = '';
      let method = '';
      const { server, port } = await startTestServer((req, res) => {
        receivedUrl = req.url || '';
        method = req.method || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli(
          ['integrations', 'delete-custom', '--key', 'MY_VAR'],
          {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        );
        expect(exitCode).toBe(0);
        expect(method).toBe('DELETE');
        expect(receivedUrl).toBe('/api/integrations/custom/MY_VAR');
      } finally {
        server.close();
      }
    });

    it('integrations set-gws sends PUT', async () => {
      let url = '';
      const { server, port } = await startTestServer(async (req, res) => {
        url = req.url || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli(
          ['integrations', 'set-gws', '--credentials-json', '{"key":"val"}'],
          {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        );
        expect(exitCode).toBe(0);
        expect(url).toBe('/api/integrations/gws');
      } finally {
        server.close();
      }
    });
  });

  // --- onboarding ---
  describe('onboarding', () => {
    it('onboarding status returns status object', async () => {
      const status = {
        slack: { installed: true, configured: true },
        github: { installed: false, configured: false },
        claude: { configured: true },
        custom: { configured: false },
        gws: { configured: false },
      };
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
      });
      try {
        const { stdout, exitCode } = await runCli(['onboarding', 'status'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(JSON.parse(stdout)).toEqual(status);
      } finally {
        server.close();
      }
    });
  });

  // --- triggers ---
  describe('triggers', () => {
    it('triggers list returns triggers', async () => {
      const triggers = [{ id: 't1', name: 'test', type: 'webhook', enabled: true }];
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ triggers }));
      });
      try {
        const { stdout, exitCode } = await runCli(['triggers', 'list'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(JSON.parse(stdout).triggers).toEqual(triggers);
      } finally {
        server.close();
      }
    });

    it('triggers create sends POST with correct body', async () => {
      let body = '';
      const { server, port } = await startTestServer(async (req, res) => {
        body = await collectBody(req);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end('{"trigger":{"id":"t1","name":"deploy","type":"webhook","prompt":"deploy prod"}}');
      });
      try {
        const { stdout, exitCode } = await runCli(
          ['triggers', 'create', '--name', 'deploy', '--type', 'webhook', '--prompt', 'deploy prod'],
          {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        );
        expect(exitCode).toBe(0);
        const parsed = JSON.parse(body);
        expect(parsed.name).toBe('deploy');
        expect(parsed.type).toBe('webhook');
        expect(parsed.prompt).toBe('deploy prod');
      } finally {
        server.close();
      }
    });

    it('triggers create with cron schedule includes cronSchedule', async () => {
      let body = '';
      const { server, port } = await startTestServer(async (req, res) => {
        body = await collectBody(req);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end('{"trigger":{"id":"t2"}}');
      });
      try {
        const { exitCode } = await runCli(
          ['triggers', 'create', '--name', 'daily', '--type', 'cron', '--prompt', 'run checks', '--cron-schedule', '0 9 * * *'],
          {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        );
        expect(exitCode).toBe(0);
        const parsed = JSON.parse(body);
        expect(parsed.cronSchedule).toBe('0 9 * * *');
      } finally {
        server.close();
      }
    });

    it('triggers update sends PUT to correct path', async () => {
      let url = '';
      let body = '';
      const { server, port } = await startTestServer(async (req, res) => {
        url = req.url || '';
        body = await collectBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli(
          ['triggers', 'update', '--id', 't1', '--enabled', 'false'],
          {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        );
        expect(exitCode).toBe(0);
        expect(url).toBe('/api/triggers/t1');
        expect(JSON.parse(body).enabled).toBe(false);
      } finally {
        server.close();
      }
    });

    it('triggers delete sends DELETE to correct path', async () => {
      let url = '';
      let method = '';
      const { server, port } = await startTestServer((req, res) => {
        url = req.url || '';
        method = req.method || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli(['triggers', 'delete', '--id', 't1'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(method).toBe('DELETE');
        expect(url).toBe('/api/triggers/t1');
      } finally {
        server.close();
      }
    });
  });

  // --- webhook ---
  describe('webhook', () => {
    it('webhook fire sends POST to correct path', async () => {
      let url = '';
      let method = '';
      const { server, port } = await startTestServer((req, res) => {
        url = req.url || '';
        method = req.method || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli(['webhook', 'fire', '--trigger-id', 'trig-1'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
        });
        expect(exitCode).toBe(0);
        expect(method).toBe('POST');
        expect(url).toBe('/api/webhook/trig-1');
      } finally {
        server.close();
      }
    });

    it('webhook fire with --json-input sends body', async () => {
      let body = '';
      const { server, port } = await startTestServer(async (req, res) => {
        body = await collectBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCliWithStdin(
          ['webhook', 'fire', '--trigger-id', 'trig-1', '--json-input'],
          '{"key":"value"}',
          { NORI_BROKER_URL: `http://127.0.0.1:${port}` },
        );
        expect(exitCode).toBe(0);
        expect(JSON.parse(body)).toEqual({ key: 'value' });
      } finally {
        server.close();
      }
    });
  });

  // --- stats ---
  describe('stats', () => {
    it('stats sessions returns session counts', async () => {
      let url = '';
      const counts = { total: 100, slack: 50, web: 40, other: 10 };
      const { server, port } = await startTestServer((req, res) => {
        url = req.url || '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(counts));
      });
      try {
        const { stdout, exitCode } = await runCli(['stats', 'sessions', '--since', '7d'], {
          NORI_BROKER_URL: `http://127.0.0.1:${port}`,
          NORI_BROKER_TOKEN: 'test-tok',
        });
        expect(exitCode).toBe(0);
        expect(url).toContain('since=7d');
        expect(JSON.parse(stdout).total).toBe(100);
      } finally {
        server.close();
      }
    });
  });

  // --- e2e ---
  describe('e2e', () => {
    it('e2e adopt sends POST with spriteName', async () => {
      let body = '';
      let url = '';
      const { server, port } = await startTestServer(async (req, res) => {
        url = req.url || '';
        body = await collectBody(req);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end('{"url":"http://sprite","sessionId":"s1"}');
      });
      try {
        const { stdout, exitCode } = await runCli(
          ['e2e', 'adopt', '--sprite-name', 'my-sprite'],
          {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        );
        expect(exitCode).toBe(0);
        expect(url).toBe('/api/e2e/adopt');
        expect(JSON.parse(body).spriteName).toBe('my-sprite');
      } finally {
        server.close();
      }
    });
  });

  // --- error includes source path ---
  it('all errors include source path pointing to CLI directory', async () => {
    const { stdout } = await runCli(['health'], {
      NORI_BROKER_URL: '',
      NORI_BROKER_TOKEN: '',
    });
    const result = JSON.parse(stdout);
    expect(result.source).toBeDefined();
    expect(result.source).toContain('nori-broker-cli');
  });
});
