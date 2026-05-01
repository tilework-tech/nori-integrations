export interface CliError {
  ok: false;
  error: string;
  message: string;
  suggestion: string;
  source: string;
}

export interface ErrorInput {
  type: string;
  status?: number | null;
  body?: string | null;
  message?: string | null;
}

const formatHttpError = (args: {
  status: number;
  body: string;
  source: string;
}): CliError => {
  const { status, body, source } = args;
  const base = { ok: false as const, source };
  switch (status) {
    case 401:
      return {
        ...base,
        error: 'unauthorized',
        message: body.length > 0 ? body : 'Unauthorized',
        suggestion: 'Check your NORI_BROKER_TOKEN is valid and not expired',
      };
    case 403:
      return {
        ...base,
        error: 'forbidden',
        message: body.length > 0 ? body : 'Forbidden',
        suggestion: 'You do not have permission for this action',
      };
    case 404:
      return {
        ...base,
        error: 'not_found',
        message: body.length > 0 ? body : 'Not found',
        suggestion: 'Check the resource path',
      };
    case 500:
      return {
        ...base,
        error: 'server_error',
        message: body.length > 0 ? body : 'Internal server error',
        suggestion: 'The server encountered an error. Try again later',
      };
    case 503:
      return {
        ...base,
        error: 'service_unavailable',
        message: body.length > 0 ? body : 'Service unavailable',
        suggestion:
          'The broker is temporarily unavailable. Please try again shortly',
      };
    case 529:
      return {
        ...base,
        error: 'no_capacity',
        message: body.length > 0 ? body : 'No capacity available',
        suggestion: 'No machines available in the fleet. Try again later',
      };
    default:
      return {
        ...base,
        error: `http_${status}`,
        message: body.length > 0 ? body : `HTTP ${status}`,
        suggestion: 'Unexpected HTTP error',
      };
  }
};

export const formatCliError = (args: {
  input: ErrorInput;
  sourceDir: string;
}): CliError => {
  const { input, sourceDir } = args;
  const base = { ok: false as const, source: sourceDir };

  switch (input.type) {
    case 'no_token':
      return {
        ...base,
        error: 'no_token',
        message: 'No authentication token provided',
        suggestion: 'Set NORI_BROKER_TOKEN environment variable',
      };
    case 'no_broker_url':
      return {
        ...base,
        error: 'no_broker_url',
        message: 'No broker URL configured',
        suggestion: 'Set NORI_BROKER_URL environment variable',
      };
    case 'http':
      return formatHttpError({
        status: input.status ?? 0,
        body: input.body ?? '',
        source: sourceDir,
      });
    case 'network':
      return {
        ...base,
        error: 'network_error',
        message: `Network error: ${input.message ?? 'unknown'}`,
        suggestion: 'Check NORI_BROKER_URL and network connectivity',
      };
    case 'not_a_git_repo':
      return {
        ...base,
        error: 'not_a_git_repo',
        message: input.message ?? 'Path is not a git working tree',
        suggestion: 'Pass --repo-path pointing at a git working directory',
      };
    case 'invalid_turn_id':
      return {
        ...base,
        error: 'invalid_turn_id',
        message: input.message ?? 'Invalid --turn-id value',
        suggestion:
          '--turn-id must contain only [A-Za-z0-9._-]; it is used as a git ref name',
      };
    case 'invalid_seq':
      return {
        ...base,
        error: 'invalid_seq',
        message: input.message ?? 'Invalid --seq value',
        suggestion: '--seq must be a non-negative integer',
      };
    case 'invalid_timeout':
      return {
        ...base,
        error: 'invalid_timeout',
        message: input.message ?? 'Invalid --timeout-ms value',
        suggestion: '--timeout-ms must be a positive integer',
      };
    case 'bundle_not_found':
      return {
        ...base,
        error: 'bundle_not_found',
        message: input.message ?? 'Bundle file not found',
        suggestion:
          'Pass --bundle-path pointing at an existing local .bundle file',
      };
    case 'bundle_sha_mismatch':
      return {
        ...base,
        error: 'bundle_sha_mismatch',
        message: input.message ?? 'Bundle SHA-256 mismatch',
        suggestion:
          '--expected-sha256 must be 64 hex chars and match the bundle bytes',
      };
    case 'target_not_empty':
      return {
        ...base,
        error: 'target_not_empty',
        message: input.message ?? 'Target directory is not empty',
        suggestion:
          'Pass --repo-path pointing at an empty or non-existent directory',
      };
    case 'invalid_bundle':
      return {
        ...base,
        error: 'invalid_bundle',
        message: input.message ?? 'Bundle is not a valid git bundle',
        suggestion:
          'The bundle file is corrupt or was not produced by `nori-broker checkpoint create`',
      };
    default:
      return {
        ...base,
        error: 'unknown_error',
        message: input.message ?? 'An unknown error occurred',
        suggestion: 'Check logs for more details',
      };
  }
};

const EXTRA_KEYS = [
  'code',
  'status',
  'data',
  'stderr',
  'stdout',
  'cause',
] as const;

const stableStringify = (value: unknown): string => {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v as object)) return '[Circular]';
        seen.add(v as object);
      }
      if (v instanceof Error) {
        const errExtras: Record<string, unknown> = { message: v.message };
        for (const key of EXTRA_KEYS) {
          const value = (v as unknown as Record<string, unknown>)[key];
          if (value != null) errExtras[key] = value;
        }
        return errExtras;
      }
      return v;
    });
  } catch {
    return Object.prototype.toString.call(value);
  }
};

/**
 * Coerces an unknown thrown value into the most informative string available.
 * Preserves Error.message plus extras (code, status, data, stderr, stdout,
 * cause); extracts .message from plain objects and appends remaining fields;
 * JSON-stringifies any other object; passes strings through; returns
 * 'unknown error' for null/undefined.
 */
export const formatError = (args: { err: unknown }): string => {
  const { err } = args;
  if (err == null) return 'unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    const extras: Record<string, unknown> = {};
    for (const key of EXTRA_KEYS) {
      const value = (err as unknown as Record<string, unknown>)[key];
      if (value != null) extras[key] = value;
    }
    if (Object.keys(extras).length === 0) return err.message;
    return `${err.message} (${stableStringify(extras)})`;
  }
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') {
      const rest: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (k !== 'message') rest[k] = v;
      }
      if (Object.keys(rest).length === 0) return obj.message;
      return `${obj.message} (${stableStringify(rest)})`;
    }
    return stableStringify(err);
  }
  return String(err);
};
