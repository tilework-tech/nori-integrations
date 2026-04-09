export interface CliError {
  ok: false;
  error: string;
  message: string;
  suggestion: string;
  source: string;
}

export interface ErrorInput {
  type: string;
  status?: number;
  body?: string;
  message?: string;
}

export function formatError(input: ErrorInput, sourceDir: string): CliError {
  const base = { ok: false as const, source: sourceDir };

  switch (input.type) {
    case 'no_token':
      return { ...base, error: 'no_token', message: 'No authentication token provided', suggestion: 'Set NORI_BROKER_TOKEN environment variable' };
    case 'no_broker_url':
      return { ...base, error: 'no_broker_url', message: 'No broker URL configured', suggestion: 'Set NORI_BROKER_URL environment variable' };
    case 'http':
      return formatHttpError(input.status ?? 0, input.body ?? '', base);
    case 'network':
      return { ...base, error: 'network_error', message: `Network error: ${input.message ?? 'unknown'}`, suggestion: 'Check NORI_BROKER_URL and network connectivity' };
    case 'unknown':
    default:
      return { ...base, error: 'unknown_error', message: input.message ?? 'An unknown error occurred', suggestion: 'Check logs for more details' };
  }
}

function formatHttpError(status: number, body: string, base: { ok: false; source: string }): CliError {
  switch (status) {
    case 401:
      return { ...base, error: 'unauthorized', message: body || 'Unauthorized', suggestion: 'Check your NORI_BROKER_TOKEN is valid' };
    case 403:
      return { ...base, error: 'forbidden', message: body || 'Forbidden', suggestion: 'You do not have permission for this action' };
    case 404:
      return { ...base, error: 'not_found', message: body || 'Not found', suggestion: 'Check the resource path' };
    case 529:
      return { ...base, error: 'no_capacity', message: body || 'No capacity available', suggestion: 'No machines available in the fleet. Try again later' };
    case 500:
      return { ...base, error: 'server_error', message: body || 'Internal server error', suggestion: 'The server encountered an error. Try again later' };
    default:
      return { ...base, error: `http_${status}`, message: body || `HTTP ${status}`, suggestion: 'Unexpected HTTP error' };
  }
}
