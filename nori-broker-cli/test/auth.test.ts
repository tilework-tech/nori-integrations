import { describe, expect, it } from 'vitest';
import { resolveBrokerUrl } from '../src/auth.js';

describe('broker auth config', () => {
  it('uses explicit broker URL when provided', () => {
    expect(
      resolveBrokerUrl({
        env: {
          NORI_BROKER_URL: 'http://127.0.0.1:19400/',
          NORI_ORG: 'acme',
        },
      }),
    ).toBe('http://127.0.0.1:19400');
  });

  it('derives the deployed broker URL from NORI_ORG when URL is absent', () => {
    expect(
      resolveBrokerUrl({
        env: {
          NORI_ORG: 'acme',
        },
      }),
    ).toBe('https://sessions.acme.noriskillsets.dev');
  });
});
