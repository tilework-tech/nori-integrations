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

export function registerE2e(program: Command): void {
  const e2e = program
    .command('e2e')
    .description('End-to-end testing utilities');

  e2e
    .command('adopt')
    .description('Adopt a sprite for e2e testing')
    .requiredOption('--sprite-name <n>', 'Name of the sprite to adopt')
    .action(async (opts: { spriteName: string }) => {
      const { client } = requireAuth();
      try {
        const result = await client.post('/api/e2e/adopt', { spriteName: opts.spriteName });
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });
}
