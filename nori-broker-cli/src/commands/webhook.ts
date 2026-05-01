import type { Command } from 'commander';
import { publicClient } from '../auth.js';
import { runCommand } from '../runCommand.js';

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString();
};

export const registerWebhook = (args: { program: Command }): void => {
  const { program } = args;
  const webhook = program
    .command('webhook')
    .description('Fire webhook triggers');

  webhook
    .command('fire')
    .description('Fire a webhook trigger (no auth required)')
    .requiredOption('--trigger-id <id>', 'Trigger ID to fire')
    .option('--json-input', 'Read JSON body from stdin')
    .action(
      runCommand(async (opts: { triggerId: string; jsonInput?: boolean }) => {
        const client = publicClient();
        let body: Record<string, unknown> | null = null;
        if (opts.jsonInput === true) {
          const raw = await readStdin();
          body = JSON.parse(raw) as Record<string, unknown>;
        }
        return client.post({
          path: `/api/webhook/${opts.triggerId}`,
          body,
        });
      }),
    );
};
