import type { Command } from 'commander';
import { BrokerClient } from '../client.js';
import { formatError, type ErrorInput } from '../errors.js';
import { requireAuth, SOURCE_DIR } from '../auth.js';

export function registerFleet(program: Command): void {
  const fleet = program
    .command('fleet')
    .description('Manage the fleet of browser instances');

  fleet
    .command('status')
    .description('Get fleet status (no auth required)')
    .action(async () => {
      const url = process.env.NORI_BROKER_URL;
      if (!url) {
        const err = formatError({ type: 'no_broker_url' }, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
      const client = new BrokerClient(url, process.env.NORI_BROKER_TOKEN);
      try {
        const result = await client.get('/api/fleet/status');
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  fleet
    .command('set-size')
    .description('Set the fleet size')
    .requiredOption('--size <n>', 'Desired fleet size')
    .action(async (opts: { size: string }) => {
      const { client } = requireAuth();
      try {
        const result = await client.put('/api/fleet/size', { fleetSize: parseInt(opts.size, 10) });
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  fleet
    .command('get-settings')
    .description('Get fleet settings')
    .action(async () => {
      const { client } = requireAuth();
      try {
        const result = await client.get('/api/fleet/settings');
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  fleet
    .command('set-settings')
    .description('Update fleet settings')
    .option('--session-inactivity-ms <n>', 'Session inactivity timeout in ms')
    .option('--ready-max-age-ms <n>', 'Max age for ready sessions in ms')
    .option('--claimed-idle-timeout-ms <n>', 'Claimed idle timeout in ms')
    .action(async (opts: { sessionInactivityMs?: string; readyMaxAgeMs?: string; claimedIdleTimeoutMs?: string }) => {
      const { client } = requireAuth();
      const body: Record<string, unknown> = {};
      if (opts.sessionInactivityMs !== undefined) body.sessionInactivityMs = parseInt(opts.sessionInactivityMs, 10);
      if (opts.readyMaxAgeMs !== undefined) body.readyMaxAgeMs = parseInt(opts.readyMaxAgeMs, 10);
      if (opts.claimedIdleTimeoutMs !== undefined) body.claimedIdleTimeoutMs = parseInt(opts.claimedIdleTimeoutMs, 10);
      try {
        const result = await client.put('/api/fleet/settings', body);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  fleet
    .command('restart')
    .description('Restart the fleet')
    .action(async () => {
      const { client } = requireAuth();
      try {
        const result = await client.post('/api/fleet/restart');
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  fleet
    .command('get-setup')
    .description('Get fleet setup configuration')
    .action(async () => {
      const { client } = requireAuth();
      try {
        const result = await client.get('/api/fleet/setup');
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });

  fleet
    .command('set-setup')
    .description('Update fleet setup configuration')
    .option('--org-script <s>', 'Organization setup script')
    .option('--toolshed-repo-url <s>', 'Toolshed repository URL')
    .action(async (opts: { orgScript?: string; toolshedRepoUrl?: string }) => {
      const { client } = requireAuth();
      const body: Record<string, unknown> = {};
      if (opts.orgScript !== undefined) body.orgScript = opts.orgScript;
      if (opts.toolshedRepoUrl !== undefined) body.toolshedRepoUrl = opts.toolshedRepoUrl;
      try {
        const result = await client.put('/api/fleet/setup', body);
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const err = formatError(e as ErrorInput, SOURCE_DIR);
        process.stdout.write(JSON.stringify(err) + '\n');
        process.exit(1);
      }
    });
}
