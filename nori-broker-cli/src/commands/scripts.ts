import type { Command } from 'commander';
import { formatError, type ErrorInput } from '../errors.js';
import { requireAuth, SOURCE_DIR } from '../auth.js';

export function registerScripts(program: Command): void {
  const scripts = program
    .command('scripts')
    .description('Manage setup scripts and their versions');

  scripts
    .command('list')
    .description('List all script versions')
    .action(async () => {
      const { client } = requireAuth();
      try {
        const result = await client.get('/api/scripts/versions');
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  scripts
    .command('get')
    .description('Get a specific script version')
    .requiredOption('--id <id>', 'Script version ID')
    .action(async (opts: { id: string }) => {
      const { client } = requireAuth();
      try {
        const result = await client.get(`/api/scripts/versions/${opts.id}`);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });
}
