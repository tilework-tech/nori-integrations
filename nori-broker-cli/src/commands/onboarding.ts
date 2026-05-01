import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { Command } from 'commander';
import { requireAuth, resolveBrokerUrl } from '../auth.js';
import { runCommand } from '../runCommand.js';

type Provider = 'claude' | 'codex' | 'gemini';
type HandoffType = 'api-key' | 'oauth-json' | 'skip';

interface HandoffProviderOpts {
  provider?: string;
  type?: string;
  apiKey?: string;
  credentialsJson?: string;
  credentialsFile?: string;
  authJson?: string;
  authJsonFile?: string;
  oauthCredsJson?: string;
  oauthCredsFile?: string;
  googleAccountsJson?: string;
  googleAccountsFile?: string;
}

const providerPaths: Record<Provider, string> = {
  claude: '/api/integrations/claude',
  codex: '/api/integrations/codex',
  gemini: '/api/integrations/gemini',
};

const defaultCredentialFiles = {
  claude: '~/.claude/.credentials.json',
  codexAuth: '~/.codex/auth.json',
  geminiOauth: '~/.gemini/oauth_creds.json',
  geminiAccounts: '~/.gemini/google_accounts.json',
};

const parseProvider = (value?: string): Provider => {
  if (value === 'claude' || value === 'codex' || value === 'gemini') {
    return value;
  }
  throw new Error('Provider must be one of: claude, codex, gemini');
};

const parseHandoffType = (value?: string): HandoffType => {
  if (value === 'api-key' || value === 'oauth-json' || value === 'skip') {
    return value;
  }
  throw new Error('Type must be one of: api-key, oauth-json, skip');
};

const resolveUserPath = (rawPath: string): string => {
  if (rawPath === '~') return homedir();
  if (rawPath.startsWith('~/')) return path.join(homedir(), rawPath.slice(2));
  return rawPath;
};

const readCredentialFile = (rawPath: string): string => {
  const resolvedPath = resolveUserPath(rawPath);
  try {
    return readFileSync(resolvedPath, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read credential file ${resolvedPath}: ${err}`);
  }
};

const requireValue = (args: { value?: string; name: string }): string => {
  const { value, name } = args;
  if (value == null || value.length === 0) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const dashboardUrl = (): string => {
  const url = resolveBrokerUrl({ env: process.env });
  if (url == null) {
    throw { type: 'no_broker_url' };
  }
  return url;
};

const buildCredentialBody = (args: {
  provider: Provider;
  type: Exclude<HandoffType, 'skip'>;
  opts: HandoffProviderOpts;
}): Record<string, unknown> => {
  const { provider, type, opts } = args;
  if (type === 'api-key') {
    return {
      type: 'api-key',
      apiKey: requireValue({ value: opts.apiKey, name: '--api-key' }),
    };
  }

  if (provider === 'claude') {
    return {
      type: 'credentials-json',
      credentialsJson:
        opts.credentialsJson ??
        readCredentialFile(
          opts.credentialsFile ?? defaultCredentialFiles.claude,
        ),
    };
  }

  if (provider === 'codex') {
    return {
      type: 'oauth-json',
      authJson:
        opts.authJson ??
        readCredentialFile(
          opts.authJsonFile ?? defaultCredentialFiles.codexAuth,
        ),
    };
  }

  return {
    type: 'oauth-json',
    oauthCredsJson:
      opts.oauthCredsJson ??
      readCredentialFile(
        opts.oauthCredsFile ?? defaultCredentialFiles.geminiOauth,
      ),
    googleAccountsJson:
      opts.googleAccountsJson ??
      readCredentialFile(
        opts.googleAccountsFile ?? defaultCredentialFiles.geminiAccounts,
      ),
  };
};

export const registerOnboarding = (args: { program: Command }): void => {
  const { program } = args;
  const onboarding = program
    .command('onboarding')
    .description('Check onboarding status');

  onboarding
    .command('status')
    .description('Get onboarding status for all integrations')
    .action(
      runCommand(async () => {
        const { client } = requireAuth();
        return client.get({ path: '/api/onboarding/status' });
      }),
    );

  onboarding
    .command('complete')
    .description('Mark onboarding as complete for this organization')
    .action(
      runCommand(async () => {
        const { client } = requireAuth();
        return client.post({ path: '/api/onboarding/complete' });
      }),
    );

  onboarding
    .command('handoff-provider')
    .description('Finish onboarding by handing off provider credentials')
    .requiredOption('--provider <p>', 'Provider (claude, codex, gemini)')
    .requiredOption('--type <t>', 'Credential type (api-key, oauth-json, skip)')
    .option('--api-key <k>', 'Provider API key')
    .option('--credentials-json <j>', 'Claude credentials JSON')
    .option(
      '--credentials-file <path>',
      'Claude credentials file (default: ~/.claude/.credentials.json)',
    )
    .option('--auth-json <j>', 'Codex auth.json content')
    .option(
      '--auth-json-file <path>',
      'Codex auth.json file (default: ~/.codex/auth.json)',
    )
    .option('--oauth-creds-json <j>', 'Gemini oauth_creds.json content')
    .option(
      '--oauth-creds-file <path>',
      'Gemini oauth_creds.json file (default: ~/.gemini/oauth_creds.json)',
    )
    .option('--google-accounts-json <j>', 'Gemini google_accounts.json content')
    .option(
      '--google-accounts-file <path>',
      'Gemini google_accounts.json file (default: ~/.gemini/google_accounts.json)',
    )
    .action(
      runCommand(async (opts: HandoffProviderOpts) => {
        const provider = parseProvider(opts.provider);
        const type = parseHandoffType(opts.type);
        const url = dashboardUrl();

        if (type === 'skip') {
          return {
            ok: true,
            skipped: true,
            provider,
            dashboardUrl: url,
            message: `Onboarding is complete. Return to ${url}`,
          };
        }

        const body = buildCredentialBody({ provider, type, opts });
        const { client } = requireAuth();
        await client.put({ path: providerPaths[provider], body });

        return {
          ok: true,
          provider,
          dashboardUrl: url,
          message: `Onboarding is complete. Return to ${url}`,
        };
      }),
    );
};
