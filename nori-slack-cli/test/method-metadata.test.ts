import { describe, it, expect } from 'vitest';
import { KNOWN_METHODS } from '../src/methods.js';
import { getMethodMetadata } from '../src/method-metadata.js';

describe('method metadata coverage', () => {
  it('getMethodMetadata returns a specific description for every KNOWN_METHOD', () => {
    const fallbacks = KNOWN_METHODS.filter(m => {
      const meta = getMethodMetadata(m);
      return meta.description.startsWith('No detailed documentation');
    });
    expect(fallbacks).toEqual([]);
  });
});
