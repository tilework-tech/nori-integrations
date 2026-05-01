import { SOURCE_DIR } from './auth.js';
import { formatCliError, formatError, type ErrorInput } from './errors.js';

const toErrorInput = (e: unknown): ErrorInput => {
  if (typeof e === 'object' && e != null && 'type' in e) {
    return e as ErrorInput;
  }
  return { type: 'unknown', message: formatError({ err: e }) };
};

export const runCommand = <TOpts>(
  action: (opts: TOpts) => Promise<unknown>,
): ((opts: TOpts) => Promise<void>) => {
  return async (opts: TOpts) => {
    try {
      const result = await action(opts);
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } catch (e) {
      if (e instanceof Error && e.stack != null) {
        process.stderr.write(`${e.stack}\n`);
      }
      const err = formatCliError({
        input: toErrorInput(e),
        sourceDir: SOURCE_DIR,
      });
      process.stdout.write(`${JSON.stringify(err)}\n`);
      process.exit(1);
    }
  };
};
