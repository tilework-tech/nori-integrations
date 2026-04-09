import type { Command } from 'commander';
import { BrokerClient } from '../client.js';
import { formatError, type ErrorInput } from '../errors.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.resolve(__dirname, '../..');

export function registerWebhook(program: Command): void {
  const webhook = program
    .command('webhook')
    .description('Fire webhook triggers');

  webhook
    .command('fire')
    .description('Fire a webhook trigger (no auth required)')
    .requiredOption('--trigger-id <id>', 'Trigger ID to fire')
    .option('--json-input', 'Read JSON body from stdin')
    .action(async (opts: { triggerId: string; jsonInput?: boolean }) => {
      const url = process.env.NORI_BROKER_URL;
      if (!url) {
        const err = formatError({ type: 'no_broker_url' }, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
      const client = new BrokerClient(url, process.env.NORI_BROKER_TOKEN);
      try {
        let body: Record<string, unknown> | undefined;
        if (opts.jsonInput) {
          const chunks: Buffer[] = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk as Buffer);
          }
          body = JSON.parse(Buffer.concat(chunks).toString());
        }
        const result = await client.post(`/api/webhook/${opts.triggerId}`, body);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });
}
