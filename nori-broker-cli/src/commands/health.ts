import type { Command } from 'commander';
import { BrokerClient } from '../client.js';
import { formatError, type ErrorInput } from '../errors.js';
import { SOURCE_DIR } from '../auth.js';

export function registerHealth(program: Command): void {
  program
    .command('health')
    .description('Check the health of the broker')
    .action(async () => {
      const url = process.env.NORI_BROKER_URL;
      if (!url) {
        const err = formatError({ type: 'no_broker_url' }, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
      const client = new BrokerClient(url, process.env.NORI_BROKER_TOKEN);
      try {
        const result = await client.get('/api/health');
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });
}
