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

export function registerTriggers(program: Command): void {
  const triggers = program
    .command('triggers')
    .description('Manage webhook and cron triggers');

  triggers
    .command('list')
    .description('List all triggers')
    .action(async () => {
      const { client } = requireAuth();
      try {
        const result = await client.get('/api/triggers');
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  triggers
    .command('create')
    .description('Create a new trigger')
    .requiredOption('--name <n>', 'Trigger name')
    .requiredOption('--type <t>', 'Trigger type (webhook or cron)')
    .requiredOption('--prompt <p>', 'Prompt text')
    .option('--cron-schedule <s>', 'Cron schedule expression')
    .action(async (opts: { name: string; type: string; prompt: string; cronSchedule?: string }) => {
      const { client } = requireAuth();
      const body: Record<string, unknown> = { name: opts.name, type: opts.type, prompt: opts.prompt };
      if (opts.cronSchedule !== undefined) body.cronSchedule = opts.cronSchedule;
      try {
        const result = await client.post('/api/triggers', body);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  triggers
    .command('update')
    .description('Update an existing trigger')
    .requiredOption('--id <id>', 'Trigger ID')
    .option('--name <n>', 'Trigger name')
    .option('--prompt <p>', 'Prompt text')
    .option('--enabled <bool>', 'Enable or disable the trigger')
    .option('--cron-schedule <s>', 'Cron schedule expression')
    .action(async (opts: { id: string; name?: string; prompt?: string; enabled?: string; cronSchedule?: string }) => {
      const { client } = requireAuth();
      const body: Record<string, unknown> = {};
      if (opts.name !== undefined) body.name = opts.name;
      if (opts.prompt !== undefined) body.prompt = opts.prompt;
      if (opts.enabled !== undefined) body.enabled = opts.enabled === 'true';
      if (opts.cronSchedule !== undefined) body.cronSchedule = opts.cronSchedule;
      try {
        const result = await client.put(`/api/triggers/${opts.id}`, body);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  triggers
    .command('delete')
    .description('Delete a trigger')
    .requiredOption('--id <id>', 'Trigger ID')
    .action(async (opts: { id: string }) => {
      const { client } = requireAuth();
      try {
        const result = await client.delete(`/api/triggers/${opts.id}`);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });
}
