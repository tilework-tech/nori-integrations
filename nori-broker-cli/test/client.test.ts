import { describe, it, expect, afterEach } from 'vitest';
import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { BrokerClient, type ClientError } from '../src/client.js';

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

describe('BrokerClient', () => {
  let server: Server | null = null;

  afterEach(() => {
    if (server != null) server.close();
    server = null;
  });

  it('sends GET requests and parses JSON responses', async () => {
    const started = await startTestServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });
    server = started.server;
    const client = new BrokerClient({
      baseUrl: `http://127.0.0.1:${started.port}`,
      token: 'test-token',
    });
    const result = await client.get({ path: '/api/health' });
    expect(result).toEqual({ status: 'ok' });
  });

  it('normalizes a trailing slash in the broker base URL', async () => {
    let receivedUrl = '';
    const started = await startTestServer((req, res) => {
      receivedUrl = req.url ?? '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });
    server = started.server;
    const client = new BrokerClient({
      baseUrl: `http://127.0.0.1:${started.port}/`,
      token: 'test-token',
    });
    await client.get({ path: '/api/health' });
    expect(receivedUrl).toBe('/api/health');
  });

  it('sends Authorization Bearer header when token provided', async () => {
    let receivedAuth = '';
    const started = await startTestServer((req, res) => {
      receivedAuth = req.headers.authorization ?? '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
    server = started.server;
    const client = new BrokerClient({
      baseUrl: `http://127.0.0.1:${started.port}`,
      token: 'my-secret-token',
    });
    await client.get({ path: '/api/test' });
    expect(receivedAuth).toBe('Bearer my-secret-token');
  });

  it('omits Authorization header when no token provided', async () => {
    let receivedAuth: string | undefined = 'not-called';
    const started = await startTestServer((req, res) => {
      receivedAuth = req.headers.authorization;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
    server = started.server;
    const client = new BrokerClient({
      baseUrl: `http://127.0.0.1:${started.port}`,
      token: null,
    });
    await client.get({ path: '/api/test' });
    expect(receivedAuth).toBeUndefined();
  });

  it('sends POST requests with JSON body', async () => {
    let receivedBody = '';
    let receivedContentType = '';
    const started = await startTestServer(async (req, res) => {
      receivedContentType = req.headers['content-type'] ?? '';
      receivedBody = await collectBody(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
    server = started.server;
    const client = new BrokerClient({
      baseUrl: `http://127.0.0.1:${started.port}`,
      token: 'tok',
    });
    const result = await client.post({
      path: '/api/sessions/release',
      body: { sessionId: 'abc' },
    });
    expect(result).toEqual({ ok: true });
    expect(receivedContentType).toBe('application/json');
    expect(JSON.parse(receivedBody)).toEqual({ sessionId: 'abc' });
  });

  it('sends POST with no body when body is null', async () => {
    let receivedBody = '';
    const started = await startTestServer(async (req, res) => {
      receivedBody = await collectBody(req);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end('{"url":"http://x","sessionId":"s1"}');
    });
    server = started.server;
    const client = new BrokerClient({
      baseUrl: `http://127.0.0.1:${started.port}`,
      token: 'tok',
    });
    const result = await client.post({ path: '/api/sessions/acquire' });
    expect(result).toEqual({ url: 'http://x', sessionId: 's1' });
    expect(receivedBody).toBe('');
  });

  it('sends PUT requests with JSON body', async () => {
    let receivedMethod = '';
    const started = await startTestServer(async (req, res) => {
      receivedMethod = req.method ?? '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"fleetSize":5}');
    });
    server = started.server;
    const client = new BrokerClient({
      baseUrl: `http://127.0.0.1:${started.port}`,
      token: 'tok',
    });
    const result = await client.put({
      path: '/api/fleet/size',
      body: { fleetSize: 5 },
    });
    expect(receivedMethod).toBe('PUT');
    expect(result).toEqual({ fleetSize: 5 });
  });

  it('sends DELETE requests', async () => {
    let receivedMethod = '';
    const started = await startTestServer(async (req, res) => {
      receivedMethod = req.method ?? '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
    server = started.server;
    const client = new BrokerClient({
      baseUrl: `http://127.0.0.1:${started.port}`,
      token: 'tok',
    });
    const result = await client.delete({
      path: '/api/integrations/custom/MY_KEY',
    });
    expect(receivedMethod).toBe('DELETE');
    expect(result).toEqual({ ok: true });
  });

  it('throws structured error on HTTP 4xx', async () => {
    const started = await startTestServer((_req, res) => {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{"error":"not found"}');
    });
    server = started.server;
    const client = new BrokerClient({
      baseUrl: `http://127.0.0.1:${started.port}`,
      token: 'tok',
    });
    let caught: unknown;
    try {
      await client.get({ path: '/api/sessions/missing' });
    } catch (err) {
      caught = err;
    }
    const err = caught as ClientError;
    expect(err.type).toBe('http');
    if (err.type === 'http') {
      expect(err.status).toBe(404);
    }
  });

  it('throws structured error on HTTP 5xx', async () => {
    const started = await startTestServer((_req, res) => {
      res.writeHead(500);
      res.end('Internal Server Error');
    });
    server = started.server;
    const client = new BrokerClient({
      baseUrl: `http://127.0.0.1:${started.port}`,
      token: 'tok',
    });
    let caught: unknown;
    try {
      await client.get({ path: '/api/health' });
    } catch (err) {
      caught = err;
    }
    const err = caught as ClientError;
    expect(err.type).toBe('http');
    if (err.type === 'http') {
      expect(err.status).toBe(500);
    }
  });

  it('throws network error when server unreachable', async () => {
    const client = new BrokerClient({
      baseUrl: 'http://127.0.0.1:1',
      token: 'tok',
    });
    let caught: unknown;
    try {
      await client.get({ path: '/api/health' });
    } catch (err) {
      caught = err;
    }
    const err = caught as ClientError;
    expect(err.type).toBe('network');
    if (err.type === 'network') {
      expect(err.message).toBeDefined();
    }
  });

  it('can download binary responses', async () => {
    const binaryData = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);
    let receivedAuth: string | undefined = '';
    const started = await startTestServer((req, res) => {
      receivedAuth = req.headers.authorization;
      res.writeHead(200, {
        'Content-Type': 'application/gzip',
        'X-Nori-Claude-Session-Id': 'claude-session-123',
      });
      res.end(binaryData);
    });
    server = started.server;
    const client = new BrokerClient({
      baseUrl: `http://127.0.0.1:${started.port}`,
      token: 'tok',
    });
    const result = await client.downloadBinary({
      path: '/api/sessions/s1/download',
    });
    expect(Buffer.from(result.data)).toEqual(binaryData);
    expect(result.headers['x-nori-claude-session-id']).toBe(
      'claude-session-123',
    );
    expect(receivedAuth).toBe('Bearer tok');
  });

  it('appends query params to GET requests', async () => {
    let receivedUrl = '';
    const started = await startTestServer((req, res) => {
      receivedUrl = req.url ?? '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
    server = started.server;
    const client = new BrokerClient({
      baseUrl: `http://127.0.0.1:${started.port}`,
      token: 'tok',
    });
    await client.get({
      path: '/api/notifications',
      query: { category: 'alert', sourceId: 'src1' },
    });
    expect(receivedUrl).toBe('/api/notifications?category=alert&sourceId=src1');
  });

  it('extracts error field from JSON error responses', async () => {
    const started = await startTestServer((_req, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or expired token' }));
    });
    server = started.server;
    const client = new BrokerClient({
      baseUrl: `http://127.0.0.1:${started.port}`,
      token: 'tok',
    });
    let caught: unknown;
    try {
      await client.get({ path: '/api/sessions' });
    } catch (err) {
      caught = err;
    }
    const err = caught as ClientError;
    expect(err.type).toBe('http');
    if (err.type === 'http') {
      expect(err.status).toBe(401);
      expect(err.body).toBe('Invalid or expired token');
    }
  });

  it('falls back to raw text for non-JSON error responses', async () => {
    const started = await startTestServer((_req, res) => {
      res.writeHead(502);
      res.end('Bad Gateway');
    });
    server = started.server;
    const client = new BrokerClient({
      baseUrl: `http://127.0.0.1:${started.port}`,
      token: 'tok',
    });
    let caught: unknown;
    try {
      await client.get({ path: '/api/sessions' });
    } catch (err) {
      caught = err;
    }
    const err = caught as ClientError;
    expect(err.type).toBe('http');
    if (err.type === 'http') {
      expect(err.status).toBe(502);
      expect(err.body).toBe('Bad Gateway');
    }
  });

  it('falls back to raw text for JSON without error field', async () => {
    const started = await startTestServer((_req, res) => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ message: 'Bad request', details: 'missing field' }),
      );
    });
    server = started.server;
    const client = new BrokerClient({
      baseUrl: `http://127.0.0.1:${started.port}`,
      token: 'tok',
    });
    let caught: unknown;
    try {
      await client.get({ path: '/api/sessions' });
    } catch (err) {
      caught = err;
    }
    const err = caught as ClientError;
    expect(err.type).toBe('http');
    if (err.type === 'http') {
      expect(err.status).toBe(400);
      expect(err.body).toBe(
        '{"message":"Bad request","details":"missing field"}',
      );
    }
  });
});
