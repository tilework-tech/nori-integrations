import type { Command } from 'commander';
import { formatError, type ErrorInput } from '../errors.js';
import { requireAuth, SOURCE_DIR } from '../auth.js';

export function registerIntegrations(program: Command): void {
  const integrations = program
    .command('integrations')
    .description('Manage third-party integrations');

  integrations
    .command('set-slack')
    .description('Configure Slack integration')
    .option('--mode <m>', 'Slack mode (socket or http)')
    .option('--bot-token <t>', 'Slack bot token')
    .option('--app-token <t>', 'Slack app token')
    .option('--signing-secret <s>', 'Slack signing secret')
    .option('--client-id <s>', 'Slack client ID')
    .option('--client-secret <s>', 'Slack client secret')
    .option('--install-secret <s>', 'Slack install secret')
    .action(async (opts: { mode?: string; botToken?: string; appToken?: string; signingSecret?: string; clientId?: string; clientSecret?: string; installSecret?: string }) => {
      const { client } = requireAuth();
      const body: Record<string, unknown> = {};
      if (opts.mode !== undefined) body.mode = opts.mode;
      if (opts.botToken !== undefined) body.botToken = opts.botToken;
      if (opts.appToken !== undefined) body.appToken = opts.appToken;
      if (opts.signingSecret !== undefined) body.signingSecret = opts.signingSecret;
      if (opts.clientId !== undefined) body.clientId = opts.clientId;
      if (opts.clientSecret !== undefined) body.clientSecret = opts.clientSecret;
      if (opts.installSecret !== undefined) body.installSecret = opts.installSecret;
      try {
        const result = await client.put('/api/integrations/slack', body);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  integrations
    .command('set-github')
    .description('Configure GitHub integration')
    .option('--app-id <a>', 'GitHub App ID')
    .option('--private-key <k>', 'GitHub App private key')
    .option('--installation-id <i>', 'GitHub App installation ID')
    .action(async (opts: { appId?: string; privateKey?: string; installationId?: string }) => {
      const { client } = requireAuth();
      const body: Record<string, unknown> = {};
      if (opts.appId !== undefined) body.appId = opts.appId;
      if (opts.privateKey !== undefined) body.privateKey = opts.privateKey;
      if (opts.installationId !== undefined) body.installationId = opts.installationId;
      try {
        const result = await client.put('/api/integrations/github', body);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  integrations
    .command('set-claude')
    .description('Configure Claude AI integration')
    .option('--type <t>', 'Credential type (api-key or vertex)')
    .option('--api-key <k>', 'Claude API key')
    .option('--credentials-json <j>', 'Vertex credentials JSON')
    .action(async (opts: { type?: string; apiKey?: string; credentialsJson?: string }) => {
      const { client } = requireAuth();
      const body: Record<string, unknown> = {};
      if (opts.type !== undefined) body.type = opts.type;
      if (opts.apiKey !== undefined) body.apiKey = opts.apiKey;
      if (opts.credentialsJson !== undefined) body.credentialsJson = opts.credentialsJson;
      try {
        const result = await client.put('/api/integrations/claude', body);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  integrations
    .command('set-custom')
    .description('Set a custom integration key-value pair')
    .requiredOption('--key <k>', 'Integration key')
    .requiredOption('--value <v>', 'Integration value')
    .action(async (opts: { key: string; value: string }) => {
      const { client } = requireAuth();
      try {
        const result = await client.put('/api/integrations/custom', { key: opts.key, value: opts.value });
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  integrations
    .command('list-custom')
    .description('List custom integration entries')
    .action(async () => {
      const { client } = requireAuth();
      try {
        const result = await client.get('/api/integrations/custom');
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  integrations
    .command('delete-custom')
    .description('Delete a custom integration entry')
    .requiredOption('--key <k>', 'Integration key to delete')
    .action(async (opts: { key: string }) => {
      const { client } = requireAuth();
      try {
        const result = await client.delete(`/api/integrations/custom/${opts.key}`);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  integrations
    .command('set-gws')
    .description('Configure Google Workspace integration')
    .option('--credentials-json <j>', 'GWS credentials JSON')
    .action(async (opts: { credentialsJson?: string }) => {
      const { client } = requireAuth();
      const body: Record<string, unknown> = {};
      if (opts.credentialsJson !== undefined) body.credentialsJson = opts.credentialsJson;
      try {
        const result = await client.put('/api/integrations/gws', body);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });
}
