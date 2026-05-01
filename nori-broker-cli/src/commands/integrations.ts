import type { Command } from 'commander';
import { requireAuth } from '../auth.js';
import { runCommand } from '../runCommand.js';

interface SlackOpts {
  mode?: string;
  botToken?: string;
  appToken?: string;
  signingSecret?: string;
  clientId?: string;
  clientSecret?: string;
  installSecret?: string;
}

interface GithubOpts {
  appId?: string;
  privateKey?: string;
  installationId?: string;
}

interface ClaudeOpts {
  type?: string;
  apiKey?: string;
  credentialsJson?: string;
}

interface GwsOpts {
  credentialsJson?: string;
}

const pickDefined = (
  source: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) {
    if (v != null) out[k] = v;
  }
  return out;
};

export const registerIntegrations = (args: { program: Command }): void => {
  const { program } = args;
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
    .action(
      runCommand(async (opts: SlackOpts) => {
        const { client } = requireAuth();
        const body = pickDefined({
          mode: opts.mode,
          botToken: opts.botToken,
          appToken: opts.appToken,
          signingSecret: opts.signingSecret,
          clientId: opts.clientId,
          clientSecret: opts.clientSecret,
          installSecret: opts.installSecret,
        });
        return client.put({ path: '/api/integrations/slack', body });
      }),
    );

  integrations
    .command('set-github')
    .description('Configure GitHub integration')
    .option('--app-id <a>', 'GitHub App ID')
    .option('--private-key <k>', 'GitHub App private key')
    .option('--installation-id <i>', 'GitHub App installation ID')
    .action(
      runCommand(async (opts: GithubOpts) => {
        const { client } = requireAuth();
        const body = pickDefined({
          appId: opts.appId,
          privateKey: opts.privateKey,
          installationId: opts.installationId,
        });
        return client.put({ path: '/api/integrations/github', body });
      }),
    );

  integrations
    .command('set-claude')
    .description('Configure Claude AI integration')
    .option('--type <t>', 'Credential type (api-key or credentials-json)')
    .option('--api-key <k>', 'Claude API key')
    .option('--credentials-json <j>', 'Claude credentials JSON')
    .action(
      runCommand(async (opts: ClaudeOpts) => {
        const { client } = requireAuth();
        const body = pickDefined({
          type: opts.type,
          apiKey: opts.apiKey,
          credentialsJson: opts.credentialsJson,
        });
        return client.put({ path: '/api/integrations/claude', body });
      }),
    );

  integrations
    .command('set-custom')
    .description('Set a custom integration key-value pair')
    .requiredOption('--key <k>', 'Integration key')
    .requiredOption('--value <v>', 'Integration value')
    .action(
      runCommand(async (opts: { key: string; value: string }) => {
        const { client } = requireAuth();
        return client.put({
          path: '/api/integrations/custom',
          body: { key: opts.key, value: opts.value },
        });
      }),
    );

  integrations
    .command('list-custom')
    .description('List custom integration entries')
    .action(
      runCommand(async () => {
        const { client } = requireAuth();
        return client.get({ path: '/api/integrations/custom' });
      }),
    );

  integrations
    .command('delete-custom')
    .description('Delete a custom integration entry')
    .requiredOption('--key <k>', 'Integration key to delete')
    .action(
      runCommand(async (opts: { key: string }) => {
        const { client } = requireAuth();
        return client.delete({ path: `/api/integrations/custom/${opts.key}` });
      }),
    );

  integrations
    .command('set-gws')
    .description('Configure Google Workspace integration')
    .option('--credentials-json <j>', 'GWS credentials JSON')
    .action(
      runCommand(async (opts: GwsOpts) => {
        const { client } = requireAuth();
        const body = pickDefined({ credentialsJson: opts.credentialsJson });
        return client.put({ path: '/api/integrations/gws', body });
      }),
    );
};
