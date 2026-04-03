import { describe, it, expect } from 'vitest';
import { mergePages } from '../src/paginate.js';

async function* toAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) {
    yield item;
  }
}

describe('mergePages', () => {
  it('returns a single page as-is when only one page exists', async () => {
    const pages = [
      { ok: true, channels: [{ id: 'C1' }, { id: 'C2' }], response_metadata: { next_cursor: '' } },
    ];
    const result = await mergePages(toAsyncIterable(pages));
    expect(result.ok).toBe(true);
    expect(result.channels).toEqual([{ id: 'C1' }, { id: 'C2' }]);
  });

  it('concatenates array fields across multiple pages', async () => {
    const pages = [
      { ok: true, channels: [{ id: 'C1' }], response_metadata: { next_cursor: 'abc' } },
      { ok: true, channels: [{ id: 'C2' }], response_metadata: { next_cursor: 'def' } },
      { ok: true, channels: [{ id: 'C3' }], response_metadata: { next_cursor: '' } },
    ];
    const result = await mergePages(toAsyncIterable(pages));
    expect(result.channels).toEqual([{ id: 'C1' }, { id: 'C2' }, { id: 'C3' }]);
  });

  it('handles pages with empty arrays', async () => {
    const pages = [
      { ok: true, members: [{ id: 'U1' }], response_metadata: { next_cursor: 'abc' } },
      { ok: true, members: [], response_metadata: { next_cursor: '' } },
    ];
    const result = await mergePages(toAsyncIterable(pages));
    expect(result.members).toEqual([{ id: 'U1' }]);
  });

  it('concatenates multiple independent array fields across pages', async () => {
    const pages = [
      { ok: true, channels: [{ id: 'C1' }], users: [{ id: 'U1' }], response_metadata: { next_cursor: 'abc' } },
      { ok: true, channels: [{ id: 'C2' }], users: [{ id: 'U2' }], response_metadata: { next_cursor: '' } },
    ];
    const result = await mergePages(toAsyncIterable(pages));
    expect(result.channels).toEqual([{ id: 'C1' }, { id: 'C2' }]);
    expect(result.users).toEqual([{ id: 'U1' }, { id: 'U2' }]);
  });

  it('handles a single empty page', async () => {
    const pages = [
      { ok: true, channels: [], response_metadata: { next_cursor: '' } },
    ];
    const result = await mergePages(toAsyncIterable(pages));
    expect(result.channels).toEqual([]);
  });
});
