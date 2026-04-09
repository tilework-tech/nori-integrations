import type { Command } from 'commander';
import { BrokerClient } from '../client.js';
import { formatError, type ErrorInput } from '../errors.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.resolve(__dirname, '../..');

function requireAuth(): { client: BrokerClient } {
  const url = process.env.NORI_BROKER_URL;
  const token = process.env.NORI_BROKER_TOKEN;
  if (!url) {
    const err = formatError({ type: 'no_broker_url' }, SOURCE_DIR);
    process.stdout.write(JSON.stringify(err) + '\n');
    process.exit(1);
  }
  if (!token) {
    const err = formatError({ type: 'no_token' }, SOURCE_DIR);
    process.stdout.write(JSON.stringify(err) + '\n');
    process.exit(1);
  }
  return { client: new BrokerClient(url, token) };
}

export function registerStats(program: Command): void {
  const stats = program
    .command('stats')
    .description('View session statistics');

  stats
    .command('sessions')
    .description('Get session statistics')
    .option('--since <period>', 'Time period (e.g., 7d, today)')
    .action(async (opts: { since?: string }) => {
      const { client } = requireAuth();
      const query: Record<string, string> = {};
      if (opts.since) query.since = opts.since;
      try {
        const result = await client.get('/api/stats/sessions', Object.keys(query).length > 0 ? query : undefined);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });
}
