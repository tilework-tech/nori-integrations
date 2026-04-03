#!/usr/bin/env node

import { Command } from 'commander';
import { WebClient } from '@slack/web-api';
import { parseArgs } from './parse-args.js';
import { formatError } from './errors.js';
import { KNOWN_METHODS } from './methods.js';
import { mergePages } from './paginate.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.resolve(__dirname, '..');

const program = new Command();

program
  .name('nori-slack')
  .description('CLI for the Slack Web API. Designed for coding agents.\n\nUsage: nori-slack <method> [--param value ...]\n\nExamples:\n  nori-slack chat.postMessage --channel C123 --text "Hello"\n  nori-slack conversations.list --limit 10\n  nori-slack api.test --foo bar\n  echo \'{"channel":"C123","text":"hi"}\' | nori-slack chat.postMessage --json-input')
  .version('0.1.0');

program
  .command('list-methods')
  .description('List all known Slack Web API methods')
  .action(() => {
    process.stdout.write(JSON.stringify({ methods: KNOWN_METHODS }) + '\n');
  });

program
  .argument('<method>', 'Slack Web API method (e.g., chat.postMessage)')
  .option('--json-input', 'Read parameters as JSON from stdin')
  .option('--paginate', 'Automatically fetch all pages and merge results')
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action(async (method: string, opts: Record<string, any>) => {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      const error = formatError({ code: 'no_token' }, SOURCE_DIR);
      process.stdout.write(JSON.stringify(error) + '\n');
      process.exit(1);
    }

    const client = new WebClient(token);

    let params: Record<string, unknown> = {};

    if (opts.jsonInput) {
      if (process.stdin.isTTY) {
        const error = formatError(
          new Error('--json-input requires piped input. Example: echo \'{"channel":"C123"}\' | nori-slack chat.postMessage --json-input'),
          SOURCE_DIR
        );
        process.stdout.write(JSON.stringify(error) + '\n');
        process.exit(2);
      }
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const stdinData = Buffer.concat(chunks).toString().trim();
      if (stdinData) {
        try {
          params = JSON.parse(stdinData);
        } catch {
          const error = formatError(
            new Error(`Invalid JSON on stdin: ${stdinData.slice(0, 100)}`),
            SOURCE_DIR
          );
          process.stdout.write(JSON.stringify(error) + '\n');
          process.exit(2);
        }
      }
    }

    // Parse CLI args directly from process.argv, skipping node, script, and method
    const methodIndex = process.argv.indexOf(method);
    const rawArgs = methodIndex >= 0 ? process.argv.slice(methodIndex + 1).filter(a => a !== '--json-input' && a !== '--paginate') : [];
    const cliParams = parseArgs(rawArgs);
    params = { ...params, ...cliParams };

    try {
      let result;
      if (opts.paginate) {
        result = await mergePages(client.paginate(method, params));
      } else {
        result = await client.apiCall(method, params);
      }
      process.stdout.write(JSON.stringify(result) + '\n');
    } catch (err) {
      const error = formatError(err, SOURCE_DIR);
      process.stdout.write(JSON.stringify(error) + '\n');
      process.stderr.write(`Error: ${error.message}\nSuggestion: ${error.suggestion}\n`);
      process.exit(1);
    }
  });

// Show help on stderr when no args provided
if (process.argv.length <= 2) {
  process.stderr.write(program.helpInformation() + '\n');
  process.stderr.write('Error: missing required method argument\n');
  process.stderr.write(`Source: ${SOURCE_DIR}\n`);
  process.exit(2);
}

program.parse();
