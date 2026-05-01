import type { Command } from 'commander';
import { publicClient } from '../auth.js';
import { runCommand } from '../runCommand.js';

export const registerHealth = (args: { program: Command }): void => {
  const { program } = args;
  program
    .command('health')
    .description('Check the health of the broker')
    .action(
      runCommand(async () => {
        const client = publicClient();
        return client.get({ path: '/api/health' });
      }),
    );
};
