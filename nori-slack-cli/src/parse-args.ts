function coerceValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Try JSON parse for arrays/objects
  if ((value.startsWith('[') && value.endsWith(']')) ||
      (value.startsWith('{') && value.endsWith('}'))) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // Coerce integers only — floats stay as strings to preserve precision
  // (Slack timestamps like thread_ts="1716000000.001200" lose trailing zeros as numbers)
  if (/^-?\d+$/.test(value) && !(/^0\d/.test(value))) {
    const num = Number(value);
    if (!isNaN(num)) return num;
  }

  return value;
}

function kebabToSnake(str: string): string {
  return str.replace(/-/g, '_');
}

export function parseArgs(argv: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    if (!arg.startsWith('--')) {
      i++;
      continue;
    }

    // Handle --flag=value
    if (arg.includes('=')) {
      const eqIndex = arg.indexOf('=');
      const key = kebabToSnake(arg.slice(2, eqIndex));
      const value = arg.slice(eqIndex + 1);
      result[key] = coerceValue(value);
      i++;
      continue;
    }

    const key = kebabToSnake(arg.slice(2));
    const next = argv[i + 1];

    // Standalone flag (no value, or next arg is also a flag)
    if (next === undefined || next.startsWith('--')) {
      result[key] = true;
      i++;
      continue;
    }

    result[key] = coerceValue(next);
    i += 2;
  }

  return result;
}
