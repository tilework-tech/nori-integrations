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

export function registerSessions(program: Command): void {
  const sessions = program
    .command('sessions')
    .description('Manage browser sessions in the fleet');

  sessions
    .command('list')
    .description('List all sessions')
    .action(async () => {
      const { client } = requireAuth();
      try {
        const result = await client.get('/api/sessions');
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  sessions
    .command('acquire')
    .description('Acquire a session from the pool')
    .action(async () => {
      const { client } = requireAuth();
      try {
        const result = await client.post('/api/sessions/acquire');
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  sessions
    .command('release')
    .description('Release a session back to the pool')
    .requiredOption('--session-id <id>', 'Session ID to release')
    .action(async (opts: { sessionId: string }) => {
      const { client } = requireAuth();
      try {
        const result = await client.post('/api/sessions/release', { sessionId: opts.sessionId });
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  sessions
    .command('start')
    .description('Start a session')
    .requiredOption('--id <id>', 'Session ID')
    .action(async (opts: { id: string }) => {
      const { client } = requireAuth();
      try {
        const result = await client.post(`/api/sessions/${opts.id}/start`);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  sessions
    .command('restart')
    .description('Restart a session')
    .requiredOption('--id <id>', 'Session ID')
    .action(async (opts: { id: string }) => {
      const { client } = requireAuth();
      try {
        const result = await client.post(`/api/sessions/${opts.id}/restart`);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  sessions
    .command('destroy')
    .description('Destroy a session')
    .requiredOption('--id <id>', 'Session ID')
    .action(async (opts: { id: string }) => {
      const { client } = requireAuth();
      try {
        const result = await client.post(`/api/sessions/${opts.id}/destroy`);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });
}
