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

export function registerNotifications(program: Command): void {
  const notifications = program
    .command('notifications')
    .description('Manage broker notifications');

  notifications
    .command('list')
    .description('List notifications')
    .option('--category <c>', 'Filter by category')
    .option('--source-id <s>', 'Filter by source ID')
    .action(async (opts: { category?: string; sourceId?: string }) => {
      const { client } = requireAuth();
      const query: Record<string, string> = {};
      if (opts.category) query.category = opts.category;
      if (opts.sourceId) query.sourceId = opts.sourceId;
      try {
        const result = await client.get('/api/notifications', Object.keys(query).length > 0 ? query : undefined);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  notifications
    .command('dismiss')
    .description('Dismiss a notification')
    .requiredOption('--id <id>', 'Notification ID')
    .action(async (opts: { id: string }) => {
      const { client } = requireAuth();
      try {
        const result = await client.post(`/api/notifications/${opts.id}/dismiss`);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  notifications
    .command('dismiss-all')
    .description('Dismiss all notifications')
    .action(async () => {
      const { client } = requireAuth();
      try {
        const result = await client.post('/api/notifications/dismiss-all');
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  notifications
    .command('dismiss-by-category')
    .description('Dismiss all notifications in a category')
    .requiredOption('--category <c>', 'Category to dismiss')
    .action(async (opts: { category: string }) => {
      const { client } = requireAuth();
      try {
        const result = await client.post('/api/notifications/dismiss-by-category', { category: opts.category });
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });
}
