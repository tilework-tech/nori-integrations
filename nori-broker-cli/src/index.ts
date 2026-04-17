#!/usr/bin/env node

import { Command } from 'commander';
import { registerHealth } from './commands/health.js';
import { registerSessions } from './commands/sessions.js';
import { registerFleet } from './commands/fleet.js';
import { registerScripts } from './commands/scripts.js';
import { registerNotifications } from './commands/notifications.js';
import { registerIntegrations } from './commands/integrations.js';
import { registerOnboarding } from './commands/onboarding.js';
import { registerTriggers } from './commands/triggers.js';
import { registerWebhook } from './commands/webhook.js';
import { registerStats } from './commands/stats.js';
import { registerE2e } from './commands/e2e.js';
import { registerLogs } from './commands/logs.js';

const program = new Command();
program
  .name('nori-broker')
  .description('CLI for the nori broker API. Designed for coding agents.')
  .version('0.1.0');

registerHealth(program);
registerSessions(program);
registerFleet(program);
registerScripts(program);
registerNotifications(program);
registerIntegrations(program);
registerOnboarding(program);
registerTriggers(program);
registerWebhook(program);
registerStats(program);
registerE2e(program);
registerLogs(program);

if (process.argv.length <= 2) {
  process.stderr.write(program.helpInformation() + '\n');
  process.exit(2);
}

program.parse();
