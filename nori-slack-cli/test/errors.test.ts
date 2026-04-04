import { describe, it, expect } from 'vitest';
import { formatError } from '../src/errors.js';

describe('formatError', () => {
  it('produces a structured error with all required fields', () => {
    const result = formatError(new Error('test'), '/path/to/source');
    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(typeof result.message).toBe('string');
    expect(typeof result.suggestion).toBe('string');
    expect(result.source).toBe('/path/to/source');
  });

  it('suggests checking channel ID for channel_not_found errors', () => {
    const slackError = {
      code: 'slack_webapi_platform_error',
      data: { ok: false, error: 'channel_not_found' },
    };
    const result = formatError(slackError, '/src');
    expect(result.suggestion).toContain('conversations.list');
  });

  it('includes retry timing for rate limit errors', () => {
    const rateLimitError = {
      code: 'slack_webapi_rate_limited_error',
      retryAfter: 30,
    };
    const result = formatError(rateLimitError, '/src');
    expect(result.message).toContain('30');
  });

  it('surfaces the underlying message for network errors', () => {
    const reqError = {
      code: 'slack_webapi_request_error',
      original: new Error('ECONNREFUSED'),
    };
    const result = formatError(reqError, '/src');
    expect(result.message).toContain('ECONNREFUSED');
  });

  it('suggests setting SLACK_BOT_TOKEN for missing token errors', () => {
    const tokenError = { code: 'no_token' };
    const result = formatError(tokenError, '/src');
    expect(result.suggestion).toContain('SLACK_BOT_TOKEN');
  });

  it('suggests checking bot scopes for missing_scope errors', () => {
    const scopeError = {
      code: 'slack_webapi_platform_error',
      data: { ok: false, error: 'missing_scope' },
    };
    const result = formatError(scopeError, '/src');
    expect(result.suggestion).toContain('scope');
  });
});
