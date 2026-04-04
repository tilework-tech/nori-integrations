export interface CliError {
  ok: false;
  error: string;
  message: string;
  suggestion: string;
  source: string;
}

const SUGGESTIONS: Record<string, string> = {
  channel_not_found: 'Check the channel ID. Use `nori-slack conversations.list` to find valid channels.',
  not_in_channel: 'The bot is not in this channel. Use `nori-slack conversations.join --channel <id>` first.',
  invalid_auth: 'The bot token is invalid. Check that SLACK_BOT_TOKEN is set to a valid xoxb-* token.',
  missing_scope: 'The bot token lacks a required scope. Check your Slack app permissions at https://api.slack.com/apps.',
  no_token: 'Set the SLACK_BOT_TOKEN environment variable. Example: export SLACK_BOT_TOKEN=xoxb-your-token',
  account_inactive: 'The token belongs to a deactivated account. Generate a new token.',
  token_revoked: 'The bot token has been revoked. Generate a new token from your Slack app settings.',
  channel_not_found_or_not_accessible: 'The channel does not exist or the bot cannot access it. Use `nori-slack conversations.list` to check.',
  not_authed: 'No authentication token provided. Set SLACK_BOT_TOKEN environment variable.',
  too_many_attachments: 'Message has too many attachments. Slack limits to 100 attachments per message.',
  msg_too_long: 'Message text exceeds 40,000 characters. Split into multiple messages.',
  no_text: 'Message must include text, blocks, or attachments. Provide at least one.',
  rate_limited: 'Rate limited by Slack. Wait and retry.',
};

export function formatError(error: unknown, sourceDir: string): CliError {
  const err = error as Record<string, any>;

  if (err?.code === 'no_token') {
    return {
      ok: false,
      error: 'no_token',
      message: 'No Slack bot token provided.',
      suggestion: SUGGESTIONS.no_token,
      source: sourceDir,
    };
  }

  if (err?.code === 'slack_webapi_platform_error') {
    const slackError = err.data?.error || 'unknown_platform_error';
    return {
      ok: false,
      error: slackError,
      message: `Slack API error: ${slackError}`,
      suggestion: SUGGESTIONS[slackError] || `Refer to Slack API docs for error "${slackError}". Run \`nori-slack list-methods\` for available methods.`,
      source: sourceDir,
    };
  }

  if (err?.code === 'slack_webapi_rate_limited_error') {
    const retryAfter = err.retryAfter || 'unknown';
    return {
      ok: false,
      error: 'rate_limited',
      message: `Rate limited. Retry after ${retryAfter} seconds.`,
      suggestion: SUGGESTIONS.rate_limited,
      source: sourceDir,
    };
  }

  if (err?.code === 'slack_webapi_request_error') {
    const originalMsg = err.original?.message || 'Unknown network error';
    return {
      ok: false,
      error: 'request_error',
      message: `Network error: ${originalMsg}`,
      suggestion: 'Check your network connection and try again.',
      source: sourceDir,
    };
  }

  // Generic fallback
  const message = err?.message || String(error);
  return {
    ok: false,
    error: 'unknown_error',
    message,
    suggestion: `Unexpected error. Check the CLI source at ${sourceDir} for details.`,
    source: sourceDir,
  };
}
