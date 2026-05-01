import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BrokerClient } from './client.js';
import type { ErrorInput } from './errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SOURCE_DIR = path.resolve(__dirname, '..');

export const resolveBrokerUrl = (args: {
  env: Record<string, string | undefined>;
}): string | null => {
  const { env } = args;
  const explicitUrl = env.NORI_BROKER_URL;
  if (explicitUrl != null && explicitUrl.length > 0) {
    return explicitUrl.replace(/\/+$/, '');
  }

  const org = env.NORI_ORG;
  if (org == null || org.length === 0) return null;

  return `https://sessions.${org}.noriskillsets.dev`;
};

export const requireAuth = (): { client: BrokerClient } => {
  const url = resolveBrokerUrl({ env: process.env });
  const token = process.env.NORI_BROKER_TOKEN;
  if (url == null) {
    const err: ErrorInput = { type: 'no_broker_url' };
    throw err;
  }
  if (token == null || token.length === 0) {
    const err: ErrorInput = { type: 'no_token' };
    throw err;
  }
  return { client: new BrokerClient({ baseUrl: url, token }) };
};

export const publicClient = (): BrokerClient => {
  const url = resolveBrokerUrl({ env: process.env });
  if (url == null) {
    const err: ErrorInput = { type: 'no_broker_url' };
    throw err;
  }
  const token = process.env.NORI_BROKER_TOKEN;
  return new BrokerClient({
    baseUrl: url,
    token: token == null || token.length === 0 ? null : token,
  });
};
