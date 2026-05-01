import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

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
  handler: (req: IncomingMessage, res: ServerResponse) => void,
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

const collectBody = (req: IncomingMessage): Promise<string> => {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
};

describe('CLI integration', () => {
  it('exits with code 2 and shows help when no args given', async () => {
    const { stderr, exitCode } = await runCli({ cliArgs: [] });
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('nori-broker');
  });

  it('shows help with --help flag', async () => {
    const { stdout } = await runCli({ cliArgs: ['--help'] });
    expect(stdout).toContain('nori-broker');
    expect(stdout).toContain('sessions');
    expect(stdout).toContain('fleet');
    expect(stdout).toContain('triggers');
  });

  it('shows version with --version flag', async () => {
    const { stdout } = await runCli({ cliArgs: ['--version'] });
    const pkg = JSON.parse(
      readFileSync(path.resolve(CLI_CWD, 'package.json'), 'utf-8'),
    );
    expect(stdout.trim()).toBe(pkg.version);
  });

  describe('health', () => {
    it('returns health status from broker', async () => {
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      });
      try {
        const { stdout, exitCode } = await runCli({
          cliArgs: ['health'],
          env: { NORI_BROKER_URL: `http://127.0.0.1:${port}` },
        });
        expect(exitCode).toBe(0);
        const result = JSON.parse(stdout);
        expect(result.status).toBe('ok');
      } finally {
        server.close();
      }
    });

    it('exits with error when broker URL not set', async () => {
      const { stdout, exitCode } = await runCli({
        cliArgs: ['health'],
        env: { NORI_BROKER_URL: '', NORI_BROKER_TOKEN: '', NORI_ORG: '' },
      });
      expect(exitCode).not.toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('no_broker_url');
      expect(result.suggestion).toContain('NORI_BROKER_URL');
    });

    it('exits with network error when broker unreachable', async () => {
      const { stdout, exitCode } = await runCli({
        cliArgs: ['health'],
        env: { NORI_BROKER_URL: 'http://127.0.0.1:1' },
      });
      expect(exitCode).not.toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('network_error');
    });
  });

  describe('sessions', () => {
    it('sessions list requires token', async () => {
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      });
      try {
        const { stdout, exitCode } = await runCli({
          cliArgs: ['sessions', 'list'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: '',
          },
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
        const { stdout, exitCode } = await runCli({
          cliArgs: ['sessions', 'list'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
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
        res.end(
          JSON.stringify({ url: 'http://sprite.example', sessionId: 's1' }),
        );
      });
      try {
        const { stdout, exitCode } = await runCli({
          cliArgs: ['sessions', 'acquire'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
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
        const { exitCode } = await runCli({
          cliArgs: ['sessions', 'release', '--session-id', 'sess-123'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
        expect(exitCode).toBe(0);
        expect(JSON.parse(body).sessionId).toBe('sess-123');
      } finally {
        server.close();
      }
    });

    it('sessions release requires --session-id', async () => {
      const { exitCode } = await runCli({
        cliArgs: ['sessions', 'release'],
        env: {
          NORI_BROKER_URL: 'http://127.0.0.1:1',
          NORI_BROKER_TOKEN: 'test-tok',
        },
      });
      expect(exitCode).not.toBe(0);
    });

    it('sessions start sends POST to correct path', async () => {
      let receivedUrl = '';
      const { server, port } = await startTestServer((req, res) => {
        receivedUrl = req.url ?? '';
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: ['sessions', 'start', '--id', 'agent-1'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
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
        receivedUrl = req.url ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: ['sessions', 'restart', '--id', 'agent-1'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
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
        receivedUrl = req.url ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: ['sessions', 'destroy', '--id', 'agent-1'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
        expect(exitCode).toBe(0);
        expect(receivedUrl).toBe('/api/sessions/agent-1/destroy');
      } finally {
        server.close();
      }
    });
  });

  describe('fleet', () => {
    it('fleet status does not require token', async () => {
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            total: 5,
            running: 3,
            warm: 1,
            cold: 1,
            other: 0,
          }),
        );
      });
      try {
        const { stdout, exitCode } = await runCli({
          cliArgs: ['fleet', 'status'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: '',
          },
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
        method = req.method ?? '';
        body = await collectBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"fleetSize":10}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: ['fleet', 'set-size', '--size', '10'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
        expect(exitCode).toBe(0);
        expect(method).toBe('PUT');
        expect(JSON.parse(body).fleetSize).toBe(10);
      } finally {
        server.close();
      }
    });

    it('fleet get-settings returns settings', async () => {
      const settings = {
        fleetSize: 5,
        readyMaxAgeMs: 3600000,
        sessionInactivityMs: 300000,
        claimedIdleTimeoutMs: null,
      };
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(settings));
      });
      try {
        const { stdout, exitCode } = await runCli({
          cliArgs: ['fleet', 'get-settings'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
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
        const { exitCode } = await runCli({
          cliArgs: [
            'fleet',
            'set-settings',
            '--session-inactivity-ms',
            '60000',
          ],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
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
        method = req.method ?? '';
        url = req.url ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: ['fleet', 'restart'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
        expect(exitCode).toBe(0);
        expect(method).toBe('POST');
        expect(url).toBe('/api/fleet/restart');
      } finally {
        server.close();
      }
    });

    it('fleet get-setup returns orgScript and toolshedRepoUrl', async () => {
      const setup = {
        orgScript: 'echo hi',
        toolshedRepoUrl: 'https://github.com/x/y.git',
      };
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(setup));
      });
      try {
        const { stdout, exitCode } = await runCli({
          cliArgs: ['fleet', 'get-setup'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
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
        const { exitCode } = await runCli({
          cliArgs: [
            'fleet',
            'set-setup',
            '--toolshed-repo-url',
            'https://github.com/x/y.git',
          ],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
        expect(exitCode).toBe(0);
        expect(JSON.parse(body).toolshedRepoUrl).toBe(
          'https://github.com/x/y.git',
        );
      } finally {
        server.close();
      }
    });
  });

  describe('scripts', () => {
    it('scripts list returns versions', async () => {
      const versions = [
        {
          id: 'v1',
          scriptType: 'setup',
          content: '#!/bin/bash',
          savedAt: '2024-01-01',
        },
      ];
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ versions }));
      });
      try {
        const { stdout, exitCode } = await runCli({
          cliArgs: ['scripts', 'list'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
        expect(exitCode).toBe(0);
        expect(JSON.parse(stdout).versions).toEqual(versions);
      } finally {
        server.close();
      }
    });

    it('scripts get returns a single version', async () => {
      let receivedUrl = '';
      const version = {
        id: 'v1',
        scriptType: 'setup',
        content: '#!/bin/bash',
        savedAt: '2024-01-01',
      };
      const { server, port } = await startTestServer((req, res) => {
        receivedUrl = req.url ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(version));
      });
      try {
        const { stdout, exitCode } = await runCli({
          cliArgs: ['scripts', 'get', '--id', 'v1'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
        expect(exitCode).toBe(0);
        expect(receivedUrl).toBe('/api/scripts/versions/v1');
        expect(JSON.parse(stdout)).toEqual(version);
      } finally {
        server.close();
      }
    });
  });

  describe('notifications', () => {
    it('notifications list returns notifications', async () => {
      const notifications = [{ id: 'n1', type: 'info', message: 'hello' }];
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ notifications }));
      });
      try {
        const { stdout, exitCode } = await runCli({
          cliArgs: ['notifications', 'list'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
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
        receivedUrl = req.url ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"notifications":[]}');
      });
      try {
        await runCli({
          cliArgs: [
            'notifications',
            'list',
            '--category',
            'alert',
            '--source-id',
            'src1',
          ],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
        expect(receivedUrl).toContain('category=alert');
        expect(receivedUrl).toContain('sourceId=src1');
      } finally {
        server.close();
      }
    });

    it('notifications dismiss sends POST to correct path', async () => {
      let receivedUrl = '';
      const { server, port } = await startTestServer((req, res) => {
        receivedUrl = req.url ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: ['notifications', 'dismiss', '--id', 'n1'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
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
        receivedUrl = req.url ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true,"dismissed":5}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: ['notifications', 'dismiss-all'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
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
        const { exitCode } = await runCli({
          cliArgs: [
            'notifications',
            'dismiss-by-category',
            '--category',
            'alert',
          ],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
        expect(exitCode).toBe(0);
        expect(JSON.parse(body).category).toBe('alert');
      } finally {
        server.close();
      }
    });
  });

  describe('integrations', () => {
    it('integrations set-slack sends PUT with provided fields', async () => {
      let body = '';
      let url = '';
      const { server, port } = await startTestServer(async (req, res) => {
        url = req.url ?? '';
        body = await collectBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: [
            'integrations',
            'set-slack',
            '--bot-token',
            'xoxb-123',
            '--mode',
            'socket',
          ],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
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
      const { server, port } = await startTestServer((req, res) => {
        url = req.url ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: [
            'integrations',
            'set-github',
            '--app-id',
            'app123',
            '--installation-id',
            'inst456',
          ],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
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
        const { exitCode } = await runCli({
          cliArgs: [
            'integrations',
            'set-claude',
            '--type',
            'api-key',
            '--api-key',
            'sk-ant-xxx',
          ],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
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
        const { exitCode } = await runCli({
          cliArgs: [
            'integrations',
            'set-custom',
            '--key',
            'MY_VAR',
            '--value',
            'my_val',
          ],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
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
        const { stdout, exitCode } = await runCli({
          cliArgs: ['integrations', 'list-custom'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
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
        receivedUrl = req.url ?? '';
        method = req.method ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: ['integrations', 'delete-custom', '--key', 'MY_VAR'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
        expect(exitCode).toBe(0);
        expect(method).toBe('DELETE');
        expect(receivedUrl).toBe('/api/integrations/custom/MY_VAR');
      } finally {
        server.close();
      }
    });

    it('integrations set-gws sends PUT', async () => {
      let url = '';
      const { server, port } = await startTestServer((req, res) => {
        url = req.url ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: [
            'integrations',
            'set-gws',
            '--credentials-json',
            '{"key":"val"}',
          ],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
        expect(exitCode).toBe(0);
        expect(url).toBe('/api/integrations/gws');
      } finally {
        server.close();
      }
    });
  });

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
        const { stdout, exitCode } = await runCli({
          cliArgs: ['onboarding', 'status'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
        expect(exitCode).toBe(0);
        expect(JSON.parse(stdout)).toEqual(status);
      } finally {
        server.close();
      }
    });

    it('onboarding complete sends POST to mark onboarding done', async () => {
      let url = '';
      let method = '';
      const { server, port } = await startTestServer((req, res) => {
        url = req.url ?? '';
        method = req.method ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"onboarded":true}');
      });
      try {
        const { stdout, exitCode } = await runCli({
          cliArgs: ['onboarding', 'complete'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
        expect(exitCode).toBe(0);
        expect(method).toBe('POST');
        expect(url).toBe('/api/onboarding/complete');
        expect(JSON.parse(stdout).onboarded).toBe(true);
      } finally {
        server.close();
      }
    });

    it('onboarding handoff-provider sends Claude API key to the existing integration endpoint', async () => {
      let method = '';
      let receivedUrl = '';
      let body = '';
      const { server, port } = await startTestServer(async (req, res) => {
        method = req.method ?? '';
        receivedUrl = req.url ?? '';
        body = await collectBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { stdout, exitCode } = await runCli({
          cliArgs: [
            'onboarding',
            'handoff-provider',
            '--provider',
            'claude',
            '--type',
            'api-key',
            '--api-key',
            'sk-ant-test',
          ],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
            NORI_ORG: 'acme',
          },
        });
        expect(exitCode).toBe(0);
        expect(method).toBe('PUT');
        expect(receivedUrl).toBe('/api/integrations/claude');
        expect(JSON.parse(body)).toEqual({
          type: 'api-key',
          apiKey: 'sk-ant-test',
        });
        const result = JSON.parse(stdout);
        expect(result.dashboardUrl).toBe(`http://127.0.0.1:${port}`);
      } finally {
        server.close();
      }
    });

    it('onboarding handoff-provider reads Codex OAuth credentials from a file', async () => {
      const scratch = mkdtempSync(path.join(tmpdir(), 'nori-broker-codex-'));
      const authPath = path.join(scratch, 'auth.json');
      writeFileSync(authPath, '{"tokens":"codex"}');
      let body = '';
      let receivedUrl = '';
      const { server, port } = await startTestServer(async (req, res) => {
        receivedUrl = req.url ?? '';
        body = await collectBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: [
            'onboarding',
            'handoff-provider',
            '--provider',
            'codex',
            '--type',
            'oauth-json',
            '--auth-json-file',
            authPath,
          ],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
            NORI_ORG: 'acme',
          },
        });
        expect(exitCode).toBe(0);
        expect(receivedUrl).toBe('/api/integrations/codex');
        expect(JSON.parse(body)).toEqual({
          type: 'oauth-json',
          authJson: '{"tokens":"codex"}',
        });
      } finally {
        server.close();
        rmSync(scratch, { recursive: true, force: true });
      }
    });

    it('onboarding handoff-provider reads both Gemini OAuth credential files', async () => {
      const scratch = mkdtempSync(path.join(tmpdir(), 'nori-broker-gemini-'));
      const oauthCredsPath = path.join(scratch, 'oauth_creds.json');
      const googleAccountsPath = path.join(scratch, 'google_accounts.json');
      writeFileSync(oauthCredsPath, '{"oauth":"gemini"}');
      writeFileSync(googleAccountsPath, '{"accounts":["gemini"]}');
      let body = '';
      let receivedUrl = '';
      const { server, port } = await startTestServer(async (req, res) => {
        receivedUrl = req.url ?? '';
        body = await collectBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: [
            'onboarding',
            'handoff-provider',
            '--provider',
            'gemini',
            '--type',
            'oauth-json',
            '--oauth-creds-file',
            oauthCredsPath,
            '--google-accounts-file',
            googleAccountsPath,
          ],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
            NORI_ORG: 'acme',
          },
        });
        expect(exitCode).toBe(0);
        expect(receivedUrl).toBe('/api/integrations/gemini');
        expect(JSON.parse(body)).toEqual({
          type: 'oauth-json',
          oauthCredsJson: '{"oauth":"gemini"}',
          googleAccountsJson: '{"accounts":["gemini"]}',
        });
      } finally {
        server.close();
        rmSync(scratch, { recursive: true, force: true });
      }
    });

    it('onboarding handoff-provider can skip credential handoff and still prints the dashboard URL', async () => {
      const { stdout, exitCode } = await runCli({
        cliArgs: [
          'onboarding',
          'handoff-provider',
          '--provider',
          'claude',
          '--type',
          'skip',
        ],
        env: {
          NORI_ORG: 'acme',
          NORI_BROKER_TOKEN: '',
          NORI_BROKER_URL: '',
        },
      });
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.ok).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.dashboardUrl).toBe(
        'https://sessions.acme.noriskillsets.dev',
      );
    });

    it('onboarding handoff-provider fails before calling the broker when an OAuth file is missing', async () => {
      let called = false;
      const { server, port } = await startTestServer((_req, res) => {
        called = true;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { stdout, exitCode } = await runCli({
          cliArgs: [
            'onboarding',
            'handoff-provider',
            '--provider',
            'codex',
            '--type',
            'oauth-json',
            '--auth-json-file',
            '/tmp/nori-missing-codex-auth.json',
          ],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
            NORI_ORG: 'acme',
          },
        });
        expect(exitCode).not.toBe(0);
        expect(called).toBe(false);
        expect(JSON.parse(stdout).message).toContain(
          '/tmp/nori-missing-codex-auth.json',
        );
      } finally {
        server.close();
      }
    });
  });

  describe('triggers', () => {
    it('triggers list returns triggers', async () => {
      const triggers = [
        { id: 't1', name: 'test', type: 'webhook', enabled: true },
      ];
      const { server, port } = await startTestServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ triggers }));
      });
      try {
        const { stdout, exitCode } = await runCli({
          cliArgs: ['triggers', 'list'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
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
        res.end(
          '{"trigger":{"id":"t1","name":"deploy","type":"webhook","prompt":"deploy prod"}}',
        );
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: [
            'triggers',
            'create',
            '--name',
            'deploy',
            '--type',
            'webhook',
            '--prompt',
            'deploy prod',
          ],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
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
        const { exitCode } = await runCli({
          cliArgs: [
            'triggers',
            'create',
            '--name',
            'daily',
            '--type',
            'cron',
            '--prompt',
            'run checks',
            '--cron-schedule',
            '0 9 * * *',
          ],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
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
        url = req.url ?? '';
        body = await collectBody(req);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: ['triggers', 'update', '--id', 't1', '--enabled', 'false'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
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
        url = req.url ?? '';
        method = req.method ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: ['triggers', 'delete', '--id', 't1'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
        expect(exitCode).toBe(0);
        expect(method).toBe('DELETE');
        expect(url).toBe('/api/triggers/t1');
      } finally {
        server.close();
      }
    });
  });

  describe('webhook', () => {
    it('webhook fire sends POST to correct path', async () => {
      let url = '';
      let method = '';
      const { server, port } = await startTestServer((req, res) => {
        url = req.url ?? '';
        method = req.method ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: ['webhook', 'fire', '--trigger-id', 'trig-1'],
          env: { NORI_BROKER_URL: `http://127.0.0.1:${port}` },
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
        const { exitCode } = await runCli({
          cliArgs: [
            'webhook',
            'fire',
            '--trigger-id',
            'trig-1',
            '--json-input',
          ],
          stdin: '{"key":"value"}',
          env: { NORI_BROKER_URL: `http://127.0.0.1:${port}` },
        });
        expect(exitCode).toBe(0);
        expect(JSON.parse(body)).toEqual({ key: 'value' });
      } finally {
        server.close();
      }
    });
  });

  describe('stats', () => {
    it('stats sessions returns session counts', async () => {
      let url = '';
      const counts = { total: 100, slack: 50, web: 40, other: 10 };
      const { server, port } = await startTestServer((req, res) => {
        url = req.url ?? '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(counts));
      });
      try {
        const { stdout, exitCode } = await runCli({
          cliArgs: ['stats', 'sessions', '--since', '7d'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
        expect(exitCode).toBe(0);
        expect(url).toContain('since=7d');
        expect(JSON.parse(stdout).total).toBe(100);
      } finally {
        server.close();
      }
    });
  });

  describe('e2e', () => {
    it('e2e adopt sends POST with spriteName', async () => {
      let body = '';
      let url = '';
      const { server, port } = await startTestServer(async (req, res) => {
        url = req.url ?? '';
        body = await collectBody(req);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end('{"url":"http://sprite","sessionId":"s1"}');
      });
      try {
        const { exitCode } = await runCli({
          cliArgs: ['e2e', 'adopt', '--sprite-name', 'my-sprite'],
          env: {
            NORI_BROKER_URL: `http://127.0.0.1:${port}`,
            NORI_BROKER_TOKEN: 'test-tok',
          },
        });
        expect(exitCode).toBe(0);
        expect(url).toBe('/api/e2e/adopt');
        expect(JSON.parse(body).spriteName).toBe('my-sprite');
      } finally {
        server.close();
      }
    });
  });

  it('all errors include source path pointing to CLI directory', async () => {
    const { stdout } = await runCli({
      cliArgs: ['health'],
      env: { NORI_BROKER_URL: '', NORI_BROKER_TOKEN: '', NORI_ORG: '' },
    });
    const result = JSON.parse(stdout);
    expect(result.source).toBeDefined();
    expect(result.source).toContain('nori-broker-cli');
  });
});
