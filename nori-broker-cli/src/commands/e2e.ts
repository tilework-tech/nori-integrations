import type { Command } from 'commander';
import { formatError, type ErrorInput } from '../errors.js';
import { requireAuth, SOURCE_DIR } from '../auth.js';

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
