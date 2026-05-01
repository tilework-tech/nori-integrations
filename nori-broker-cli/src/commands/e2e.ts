import type { Command } from 'commander';
import { requireAuth } from '../auth.js';
import { runCommand } from '../runCommand.js';

export const registerE2e = (args: { program: Command }): void => {
  const { program } = args;
  const e2e = program
    .command('e2e')
    .description('End-to-end testing utilities');

  e2e
    .command('adopt')
    .description('Adopt a sprite for e2e testing')
    .requiredOption('--sprite-name <n>', 'Name of the sprite to adopt')
    .action(
      runCommand(async (opts: { spriteName: string }) => {
        const { client } = requireAuth();
        return client.post({
          path: '/api/e2e/adopt',
          body: { spriteName: opts.spriteName },
        });
      }),
    );
};
