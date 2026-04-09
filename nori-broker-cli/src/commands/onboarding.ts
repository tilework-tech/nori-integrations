import type { Command } from 'commander';
import { formatError, type ErrorInput } from '../errors.js';
import { requireAuth, SOURCE_DIR } from '../auth.js';

export function registerOnboarding(program: Command): void {
  const onboarding = program
    .command('onboarding')
    .description('Check onboarding status');

  onboarding
    .command('status')
    .description('Get onboarding status for all integrations')
    .action(async () => {
      const { client } = requireAuth();
      try {
        const result = await client.get('/api/onboarding/status');
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });
}
