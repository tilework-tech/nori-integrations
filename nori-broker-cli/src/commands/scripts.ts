import type { Command } from 'commander';
import { requireAuth } from '../auth.js';
import { runCommand } from '../runCommand.js';

export const registerScripts = (args: { program: Command }): void => {
  const { program } = args;
  const scripts = program
    .command('scripts')
    .description('Manage setup scripts and their versions');

  scripts
    .command('list')
    .description('List all script versions')
    .action(
      runCommand(async () => {
        const { client } = requireAuth();
        return client.get({ path: '/api/scripts/versions' });
      }),
    );

  scripts
    .command('get')
    .description('Get a specific script version')
    .requiredOption('--id <id>', 'Script version ID')
    .action(
      runCommand(async (opts: { id: string }) => {
        const { client } = requireAuth();
        return client.get({ path: `/api/scripts/versions/${opts.id}` });
      }),
    );
};
