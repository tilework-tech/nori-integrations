import type { Command } from 'commander';
import { requireAuth } from '../auth.js';
import { runCommand } from '../runCommand.js';

export const registerTriggers = (args: { program: Command }): void => {
  const { program } = args;
  const triggers = program
    .command('triggers')
    .description('Manage webhook and cron triggers');

  triggers
    .command('list')
    .description('List all triggers')
    .action(
      runCommand(async () => {
        const { client } = requireAuth();
        return client.get({ path: '/api/triggers' });
      }),
    );

  triggers
    .command('create')
    .description('Create a new trigger')
    .requiredOption('--name <n>', 'Trigger name')
    .requiredOption('--type <t>', 'Trigger type (webhook or cron)')
    .requiredOption('--prompt <p>', 'Prompt text')
    .option('--cron-schedule <s>', 'Cron schedule expression')
    .action(
      runCommand(
        async (opts: {
          name: string;
          type: string;
          prompt: string;
          cronSchedule?: string;
        }) => {
          const { client } = requireAuth();
          const body: Record<string, unknown> = {
            name: opts.name,
            type: opts.type,
            prompt: opts.prompt,
          };
          if (opts.cronSchedule != null) body.cronSchedule = opts.cronSchedule;
          return client.post({ path: '/api/triggers', body });
        },
      ),
    );

  triggers
    .command('update')
    .description('Update an existing trigger')
    .requiredOption('--id <id>', 'Trigger ID')
    .option('--name <n>', 'Trigger name')
    .option('--prompt <p>', 'Prompt text')
    .option('--enabled <bool>', 'Enable or disable the trigger')
    .option('--cron-schedule <s>', 'Cron schedule expression')
    .action(
      runCommand(
        async (opts: {
          id: string;
          name?: string;
          prompt?: string;
          enabled?: string;
          cronSchedule?: string;
        }) => {
          const { client } = requireAuth();
          const body: Record<string, unknown> = {};
          if (opts.name != null) body.name = opts.name;
          if (opts.prompt != null) body.prompt = opts.prompt;
          if (opts.enabled != null) body.enabled = opts.enabled === 'true';
          if (opts.cronSchedule != null) body.cronSchedule = opts.cronSchedule;
          return client.put({ path: `/api/triggers/${opts.id}`, body });
        },
      ),
    );

  triggers
    .command('delete')
    .description('Delete a trigger')
    .requiredOption('--id <id>', 'Trigger ID')
    .action(
      runCommand(async (opts: { id: string }) => {
        const { client } = requireAuth();
        return client.delete({ path: `/api/triggers/${opts.id}` });
      }),
    );
};
