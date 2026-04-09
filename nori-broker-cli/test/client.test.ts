import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { BrokerClient } from '../src/client.js';

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

describe('BrokerClient', () => {
  let server: Server;
  let port: number;

  afterEach(() => {
    if (server) server.close();
  });

  it('sends GET requests and parses JSON responses', async () => {
    ({ server, port } = await startTestServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    }));
    const client = new BrokerClient(`http://127.0.0.1:${port}`, 'test-token');
    const result = await client.get('/api/health');
    expect(result).toEqual({ status: 'ok' });
  });

  it('sends Authorization Bearer header when token provided', async () => {
    let receivedAuth = '';
    ({ server, port } = await startTestServer((req, res) => {
      receivedAuth = req.headers.authorization || '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    }));
    const client = new BrokerClient(`http://127.0.0.1:${port}`, 'my-secret-token');
    await client.get('/api/test');
    expect(receivedAuth).toBe('Bearer my-secret-token');
  });

  it('omits Authorization header when no token provided', async () => {
    let receivedAuth: string | undefined = 'not-called';
    ({ server, port } = await startTestServer((req, res) => {
      receivedAuth = req.headers.authorization;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    }));
    const client = new BrokerClient(`http://127.0.0.1:${port}`, undefined);
    await client.get('/api/test');
    expect(receivedAuth).toBeUndefined();
  });

  it('sends POST requests with JSON body', async () => {
    let receivedBody = '';
    let receivedContentType = '';
    ({ server, port } = await startTestServer(async (req, res) => {
      receivedContentType = req.headers['content-type'] || '';
      receivedBody = await collectBody(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    }));
    const client = new BrokerClient(`http://127.0.0.1:${port}`, 'tok');
    const result = await client.post('/api/sessions/release', { sessionId: 'abc' });
    expect(result).toEqual({ ok: true });
    expect(receivedContentType).toBe('application/json');
    expect(JSON.parse(receivedBody)).toEqual({ sessionId: 'abc' });
  });

  it('sends POST with no body when body is undefined', async () => {
    let receivedBody = '';
    ({ server, port } = await startTestServer(async (req, res) => {
      receivedBody = await collectBody(req);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end('{"url":"http://x","sessionId":"s1"}');
    }));
    const client = new BrokerClient(`http://127.0.0.1:${port}`, 'tok');
    const result = await client.post('/api/sessions/acquire');
    expect(result).toEqual({ url: 'http://x', sessionId: 's1' });
    expect(receivedBody).toBe('');
  });

  it('sends PUT requests with JSON body', async () => {
    let receivedMethod = '';
    ({ server, port } = await startTestServer(async (req, res) => {
      receivedMethod = req.method || '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"fleetSize":5}');
    }));
    const client = new BrokerClient(`http://127.0.0.1:${port}`, 'tok');
    const result = await client.put('/api/fleet/size', { fleetSize: 5 });
    expect(receivedMethod).toBe('PUT');
    expect(result).toEqual({ fleetSize: 5 });
  });

  it('sends DELETE requests', async () => {
    let receivedMethod = '';
    ({ server, port } = await startTestServer(async (req, res) => {
      receivedMethod = req.method || '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    }));
    const client = new BrokerClient(`http://127.0.0.1:${port}`, 'tok');
    const result = await client.delete('/api/integrations/custom/MY_KEY');
    expect(receivedMethod).toBe('DELETE');
    expect(result).toEqual({ ok: true });
  });

  it('throws structured error on HTTP 4xx', async () => {
    ({ server, port } = await startTestServer((_req, res) => {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{"error":"not found"}');
    }));
    const client = new BrokerClient(`http://127.0.0.1:${port}`, 'tok');
    try {
      await client.get('/api/sessions/missing');
      expect.unreachable('should have thrown');
    } catch (err: any) {
      expect(err.type).toBe('http');
      expect(err.status).toBe(404);
    }
  });

  it('throws structured error on HTTP 5xx', async () => {
    ({ server, port } = await startTestServer((_req, res) => {
      res.writeHead(500);
      res.end('Internal Server Error');
    }));
    const client = new BrokerClient(`http://127.0.0.1:${port}`, 'tok');
    try {
      await client.get('/api/health');
      expect.unreachable('should have thrown');
    } catch (err: any) {
      expect(err.type).toBe('http');
      expect(err.status).toBe(500);
    }
  });

  it('throws network error when server unreachable', async () => {
    const client = new BrokerClient('http://127.0.0.1:1', 'tok');
    try {
      await client.get('/api/health');
      expect.unreachable('should have thrown');
    } catch (err: any) {
      expect(err.type).toBe('network');
      expect(err.message).toBeDefined();
    }
  });

  it('can download binary responses', async () => {
    const binaryData = Buffer.from([0x1f, 0x8b, 0x08, 0x00]); // gzip magic bytes
    let receivedHeaders: Record<string, string | undefined> = {};
    ({ server, port } = await startTestServer((req, res) => {
      receivedHeaders = { auth: req.headers.authorization };
      res.writeHead(200, {
        'Content-Type': 'application/gzip',
        'X-Nori-Claude-Session-Id': 'claude-session-123',
      });
      res.end(binaryData);
    }));
    const client = new BrokerClient(`http://127.0.0.1:${port}`, 'tok');
    const result = await client.downloadBinary('/api/sessions/s1/download');
    expect(Buffer.from(result.data)).toEqual(binaryData);
    expect(result.headers['x-nori-claude-session-id']).toBe('claude-session-123');
    expect(receivedHeaders.auth).toBe('Bearer tok');
  });

  it('appends query params to GET requests', async () => {
    let receivedUrl = '';
    ({ server, port } = await startTestServer((req, res) => {
      receivedUrl = req.url || '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    }));
    const client = new BrokerClient(`http://127.0.0.1:${port}`, 'tok');
    await client.get('/api/notifications', { category: 'alert', sourceId: 'src1' });
    expect(receivedUrl).toBe('/api/notifications?category=alert&sourceId=src1');
  });
});
