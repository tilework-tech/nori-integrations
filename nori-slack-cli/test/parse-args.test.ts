import { describe, it, expect } from 'vitest';
import { parseArgs } from '../src/parse-args.js';

describe('parseArgs', () => {
  it('converts --flag value pairs into an object', () => {
    const result = parseArgs(['--channel', 'C123', '--text', 'hello world']);
    expect(result).toEqual({ channel: 'C123', text: 'hello world' });
  });

  it('converts kebab-case flags to snake_case', () => {
    const result = parseArgs(['--unfurl-links', 'true', '--reply-broadcast', 'true']);
    expect(result).toEqual({ unfurl_links: true, reply_broadcast: true });
  });

  it('handles --flag=value syntax', () => {
    const result = parseArgs(['--channel=C123', '--text=hello']);
    expect(result).toEqual({ channel: 'C123', text: 'hello' });
  });

  it('coerces boolean strings to booleans', () => {
    const result = parseArgs(['--unfurl-links', 'true', '--mrkdwn', 'false']);
    expect(result).toEqual({ unfurl_links: true, mrkdwn: false });
  });

  it('coerces numeric strings to numbers', () => {
    const result = parseArgs(['--post-at', '1234567890', '--limit', '100']);
    expect(result).toEqual({ post_at: 1234567890, limit: 100 });
  });

  it('parses JSON strings for complex values', () => {
    const blocks = JSON.stringify([{ type: 'section', text: { type: 'mrkdwn', text: 'hi' } }]);
    const result = parseArgs(['--blocks', blocks]);
    expect(result).toEqual({
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'hi' } }],
    });
  });

  it('returns empty object for empty input', () => {
    const result = parseArgs([]);
    expect(result).toEqual({});
  });

  it('treats standalone --flag without value as true', () => {
    const result = parseArgs(['--as-user']);
    expect(result).toEqual({ as_user: true });
  });

  it('handles a flag at the end with no following value', () => {
    const result = parseArgs(['--channel', 'C123', '--as-user']);
    expect(result).toEqual({ channel: 'C123', as_user: true });
  });

  it('preserves strings with leading zeros as strings', () => {
    const result = parseArgs(['--code', '007']);
    expect(result).toEqual({ code: '007' });
  });
});
