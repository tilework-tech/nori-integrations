import { describe, it, expect } from 'vitest';
import { formatError } from '../src/errors.js';

describe('formatError', () => {
  const sourceDir = '/test/source';

  it('formats no_token error with suggestion to set env var', () => {
    const result = formatError({ type: 'no_token' }, sourceDir);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('no_token');
    expect(result.suggestion).toContain('NORI_BROKER_TOKEN');
    expect(result.source).toBe(sourceDir);
  });

  it('formats no_broker_url error with suggestion to set env var', () => {
    const result = formatError({ type: 'no_broker_url' }, sourceDir);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('no_broker_url');
    expect(result.suggestion).toContain('NORI_BROKER_URL');
    expect(result.source).toBe(sourceDir);
  });

  it('formats HTTP 401 as unauthorized with token and expiry suggestion', () => {
    const result = formatError({ type: 'http', status: 401, body: 'Unauthorized' }, sourceDir);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('unauthorized');
    expect(result.suggestion).toContain('NORI_BROKER_TOKEN');
    expect(result.suggestion).toContain('expired');
    expect(result.source).toBe(sourceDir);
  });

  it('formats HTTP 403 as forbidden', () => {
    const result = formatError({ type: 'http', status: 403, body: 'Forbidden' }, sourceDir);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('forbidden');
    expect(result.source).toBe(sourceDir);
  });

  it('formats HTTP 404 as not_found', () => {
    const result = formatError({ type: 'http', status: 404, body: 'Not Found' }, sourceDir);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('not_found');
    expect(result.source).toBe(sourceDir);
  });

  it('formats HTTP 529 as capacity error', () => {
    const result = formatError({ type: 'http', status: 529, body: 'No capacity' }, sourceDir);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('no_capacity');
    expect(result.suggestion).toContain('fleet');
    expect(result.source).toBe(sourceDir);
  });

  it('formats HTTP 500 as server_error', () => {
    const result = formatError({ type: 'http', status: 500, body: 'Internal Server Error' }, sourceDir);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('server_error');
    expect(result.source).toBe(sourceDir);
  });

  it('formats network errors', () => {
    const result = formatError({ type: 'network', message: 'ECONNREFUSED' }, sourceDir);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('network_error');
    expect(result.message).toContain('ECONNREFUSED');
    expect(result.suggestion).toContain('NORI_BROKER_URL');
    expect(result.source).toBe(sourceDir);
  });

  it('formats unknown errors with source path', () => {
    const result = formatError({ type: 'unknown', message: 'something broke' }, sourceDir);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('unknown_error');
    expect(result.source).toBe(sourceDir);
  });

  it('formats HTTP 503 as service_unavailable with retry suggestion', () => {
    const result = formatError({ type: 'http', status: 503, body: 'Authentication service unavailable' }, sourceDir);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('service_unavailable');
    expect(result.message).toContain('unavailable');
    expect(result.suggestion).toContain('try again');
    expect(result.source).toBe(sourceDir);
  });

});
