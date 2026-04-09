import type { Command } from 'commander';
import { formatError, type ErrorInput } from '../errors.js';
import { requireAuth, SOURCE_DIR } from '../auth.js';

export function registerStats(program: Command): void {
  const stats = program
    .command('stats')
    .description('View session statistics');

  stats
    .command('sessions')
    .description('Get session statistics')
    .option('--since <period>', 'Time period (e.g., 7d, today)')
    .action(async (opts: { since?: string }) => {
      const { client } = requireAuth();
      const query: Record<string, string> = {};
      if (opts.since) query.since = opts.since;
      try {
        const result = await client.get('/api/stats/sessions', Object.keys(query).length > 0 ? query : undefined);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });
}
