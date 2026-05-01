import type { Command } from 'commander';
import { requireAuth } from '../auth.js';
import { runCommand } from '../runCommand.js';

export const registerSessions = (args: { program: Command }): void => {
  const { program } = args;
  const sessions = program
    .command('sessions')
    .description('Manage browser sessions in the fleet');

  sessions
    .command('list')
    .description('List all sessions')
    .action(
      runCommand(async () => {
        const { client } = requireAuth();
        return client.get({ path: '/api/sessions' });
      }),
    );

  sessions
    .command('acquire')
    .description('Acquire a session from the pool')
    .action(
      runCommand(async () => {
        const { client } = requireAuth();
        return client.post({ path: '/api/sessions/acquire' });
      }),
    );

  sessions
    .command('release')
    .description('Release a session back to the pool')
    .requiredOption('--session-id <id>', 'Session ID to release')
    .action(
      runCommand(async (opts: { sessionId: string }) => {
        const { client } = requireAuth();
        return client.post({
          path: '/api/sessions/release',
          body: { sessionId: opts.sessionId },
        });
      }),
    );

  sessions
    .command('start')
    .description('Start a session')
    .requiredOption('--id <id>', 'Session ID')
    .action(
      runCommand(async (opts: { id: string }) => {
        const { client } = requireAuth();
        return client.post({ path: `/api/sessions/${opts.id}/start` });
      }),
    );

  sessions
    .command('restart')
    .description('Restart a session')
    .requiredOption('--id <id>', 'Session ID')
    .action(
      runCommand(async (opts: { id: string }) => {
        const { client } = requireAuth();
        return client.post({ path: `/api/sessions/${opts.id}/restart` });
      }),
    );

  sessions
    .command('destroy')
    .description('Destroy a session')
    .requiredOption('--id <id>', 'Session ID')
    .action(
      runCommand(async (opts: { id: string }) => {
        const { client } = requireAuth();
        return client.post({ path: `/api/sessions/${opts.id}/destroy` });
      }),
    );
};
