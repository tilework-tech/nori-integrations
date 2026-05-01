import type { Command } from 'commander';
import { requireAuth } from '../auth.js';
import { runCommand } from '../runCommand.js';

export const registerNotifications = (args: { program: Command }): void => {
  const { program } = args;
  const notifications = program
    .command('notifications')
    .description('Manage broker notifications');

  notifications
    .command('list')
    .description('List notifications')
    .option('--category <c>', 'Filter by category')
    .option('--source-id <s>', 'Filter by source ID')
    .action(
      runCommand(async (opts: { category?: string; sourceId?: string }) => {
        const { client } = requireAuth();
        const query: Record<string, string> = {};
        if (opts.category != null) query.category = opts.category;
        if (opts.sourceId != null) query.sourceId = opts.sourceId;
        return client.get({
          path: '/api/notifications',
          query: Object.keys(query).length > 0 ? query : null,
        });
      }),
    );

  notifications
    .command('dismiss')
    .description('Dismiss a notification')
    .requiredOption('--id <id>', 'Notification ID')
    .action(
      runCommand(async (opts: { id: string }) => {
        const { client } = requireAuth();
        return client.post({
          path: `/api/notifications/${opts.id}/dismiss`,
        });
      }),
    );

  notifications
    .command('dismiss-all')
    .description('Dismiss all notifications')
    .action(
      runCommand(async () => {
        const { client } = requireAuth();
        return client.post({ path: '/api/notifications/dismiss-all' });
      }),
    );

  notifications
    .command('dismiss-by-category')
    .description('Dismiss all notifications in a category')
    .requiredOption('--category <c>', 'Category to dismiss')
    .action(
      runCommand(async (opts: { category: string }) => {
        const { client } = requireAuth();
        return client.post({
          path: '/api/notifications/dismiss-by-category',
          body: { category: opts.category },
        });
      }),
    );
};
