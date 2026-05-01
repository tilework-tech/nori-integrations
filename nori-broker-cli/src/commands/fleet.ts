import type { Command } from 'commander';
import { publicClient, requireAuth } from '../auth.js';
import { runCommand } from '../runCommand.js';

export const registerFleet = (args: { program: Command }): void => {
  const { program } = args;
  const fleet = program
    .command('fleet')
    .description('Manage the fleet of browser instances');

  fleet
    .command('status')
    .description('Get fleet status (no auth required)')
    .action(
      runCommand(async () => {
        const client = publicClient();
        return client.get({ path: '/api/fleet/status' });
      }),
    );

  fleet
    .command('set-size')
    .description('Set the fleet size')
    .requiredOption('--size <n>', 'Desired fleet size')
    .action(
      runCommand(async (opts: { size: string }) => {
        const { client } = requireAuth();
        return client.put({
          path: '/api/fleet/size',
          body: { fleetSize: Number.parseInt(opts.size, 10) },
        });
      }),
    );

  fleet
    .command('get-settings')
    .description('Get fleet settings')
    .action(
      runCommand(async () => {
        const { client } = requireAuth();
        return client.get({ path: '/api/fleet/settings' });
      }),
    );

  fleet
    .command('set-settings')
    .description('Update fleet settings')
    .option('--session-inactivity-ms <n>', 'Session inactivity timeout in ms')
    .option('--ready-max-age-ms <n>', 'Max age for ready sessions in ms')
    .option('--claimed-idle-timeout-ms <n>', 'Claimed idle timeout in ms')
    .action(
      runCommand(
        async (opts: {
          sessionInactivityMs?: string;
          readyMaxAgeMs?: string;
          claimedIdleTimeoutMs?: string;
        }) => {
          const { client } = requireAuth();
          const body: Record<string, unknown> = {};
          if (opts.sessionInactivityMs != null) {
            body.sessionInactivityMs = Number.parseInt(
              opts.sessionInactivityMs,
              10,
            );
          }
          if (opts.readyMaxAgeMs != null) {
            body.readyMaxAgeMs = Number.parseInt(opts.readyMaxAgeMs, 10);
          }
          if (opts.claimedIdleTimeoutMs != null) {
            body.claimedIdleTimeoutMs = Number.parseInt(
              opts.claimedIdleTimeoutMs,
              10,
            );
          }
          return client.put({ path: '/api/fleet/settings', body });
        },
      ),
    );

  fleet
    .command('restart')
    .description('Restart the fleet')
    .action(
      runCommand(async () => {
        const { client } = requireAuth();
        return client.post({ path: '/api/fleet/restart' });
      }),
    );

  fleet
    .command('get-setup')
    .description('Get fleet setup configuration')
    .action(
      runCommand(async () => {
        const { client } = requireAuth();
        return client.get({ path: '/api/fleet/setup' });
      }),
    );

  fleet
    .command('set-setup')
    .description('Update fleet setup configuration')
    .option('--org-script <s>', 'Organization setup script')
    .option('--toolshed-repo-url <s>', 'Toolshed repository URL')
    .action(
      runCommand(
        async (opts: { orgScript?: string; toolshedRepoUrl?: string }) => {
          const { client } = requireAuth();
          const body: Record<string, unknown> = {};
          if (opts.orgScript != null) body.orgScript = opts.orgScript;
          if (opts.toolshedRepoUrl != null) {
            body.toolshedRepoUrl = opts.toolshedRepoUrl;
          }
          return client.put({ path: '/api/fleet/setup', body });
        },
      ),
    );
};
