import type { Command } from 'commander';
import { requireAuth } from '../auth.js';
import { runCommand } from '../runCommand.js';

export const registerStats = (args: { program: Command }): void => {
  const { program } = args;
  const stats = program.command('stats').description('View session statistics');

  stats
    .command('sessions')
    .description('Get session statistics')
    .option('--since <period>', 'Time period (e.g., 7d, today)')
    .action(
      runCommand(async (opts: { since?: string }) => {
        const { client } = requireAuth();
        const query: Record<string, string> = {};
        if (opts.since != null) query.since = opts.since;
        return client.get({
          path: '/api/stats/sessions',
          query: Object.keys(query).length > 0 ? query : null,
        });
      }),
    );
};
