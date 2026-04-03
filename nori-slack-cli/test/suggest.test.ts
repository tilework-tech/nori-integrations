import { describe, it, expect } from 'vitest';
import { findSimilarMethods } from '../src/suggest.js';
import { KNOWN_METHODS } from '../src/methods.js';

describe('findSimilarMethods', () => {
  it('returns empty array when method exactly matches a known method', () => {
    const result = findSimilarMethods('chat.postMessage', KNOWN_METHODS);
    expect(result).toEqual([]);
  });

  it('suggests correct casing for case-insensitive exact match', () => {
    const result = findSimilarMethods('chat.postmessage', KNOWN_METHODS);
    expect(result).toContain('chat.postMessage');
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('suggests close match for a single-character typo', () => {
    const result = findSimilarMethods('converations.list', KNOWN_METHODS);
    expect(result).toContain('conversations.list');
  });

  it('returns empty array when no reasonable match exists', () => {
    const result = findSimilarMethods('zzzzzzz.xyzzy', KNOWN_METHODS);
    expect(result).toEqual([]);
  });

  it('returns at most 3 suggestions by default', () => {
    const result = findSimilarMethods('chat.pos', KNOWN_METHODS);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('respects custom maxResults parameter', () => {
    const result = findSimilarMethods('chat.pos', KNOWN_METHODS, 1);
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it('returns suggestions sorted by similarity (closest first)', () => {
    const result = findSimilarMethods('conversations.lis', KNOWN_METHODS);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toBe('conversations.list');
  });
});
