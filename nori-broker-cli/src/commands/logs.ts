import type { Command } from 'commander';
import { formatError, type ErrorInput } from '../errors.js';
import { requireAuth, SOURCE_DIR } from '../auth.js';

export function registerLogs(program: Command): void {
  const logs = program
    .command('logs')
    .description('Query broker logs');

  logs
    .command('query')
    .description('Query logs using LogsQL')
    .requiredOption('--query <q>', 'LogsQL query string (e.g. "_time:5m level:error")')
    .option('--limit <n>', 'Maximum number of log entries to return')
    .option('--start <time>', 'Start of time range')
    .option('--end <time>', 'End of time range')
    .action(async (opts: { query: string; limit?: string; start?: string; end?: string }) => {
      const { client } = requireAuth();
      const query: Record<string, string> = { query: opts.query };
      if (opts.limit) query.limit = opts.limit;
      if (opts.start) query.start = opts.start;
      if (opts.end) query.end = opts.end;
      try {
        const result = await client.get('/api/logs', query);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });
}
