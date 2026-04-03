export interface MethodMetadata {
  description: string;
  required_params: Record<string, string>;
  optional_params: Record<string, string>;
  supports_pagination: boolean;
  deprecated?: string;
  docs_url: string;
}

function docsUrl(method: string): string {
  return `https://api.slack.com/methods/${method}`;
}

export const METHOD_METADATA: Record<string, MethodMetadata> = {
  'chat.postMessage': {
    description: 'Sends a message to a channel, DM, or group conversation.',
    required_params: {
      channel: 'Channel ID (e.g., C1234567890)',
    },
    optional_params: {
      text: 'Message text (required if no blocks/attachments)',
      blocks: 'Array of Block Kit blocks (JSON string)',
      attachments: 'Array of attachments (JSON string)',
      thread_ts: 'Timestamp of parent message for threading',
      reply_broadcast: 'Also post threaded reply to channel (boolean)',
      unfurl_links: 'Enable URL unfurling (boolean)',
      unfurl_media: 'Enable media unfurling (boolean)',
      mrkdwn: 'Enable Slack markdown parsing (boolean)',
      metadata: 'Event metadata (JSON string)',
    },
    supports_pagination: false,
    docs_url: docsUrl('chat.postMessage'),
  },
  'chat.update': {
    description: 'Updates an existing message.',
    required_params: {
      channel: 'Channel ID containing the message',
      ts: 'Timestamp of the message to update',
    },
    optional_params: {
      text: 'New message text',
      blocks: 'Array of Block Kit blocks (JSON string)',
      attachments: 'Array of attachments (JSON string)',
    },
    supports_pagination: false,
    docs_url: docsUrl('chat.update'),
  },
  'chat.delete': {
    description: 'Deletes a message from a channel.',
    required_params: {
      channel: 'Channel ID containing the message',
      ts: 'Timestamp of the message to delete',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('chat.delete'),
  },
  'conversations.list': {
    description: 'Lists all channels visible to the authenticated token.',
    required_params: {},
    optional_params: {
      types: 'Comma-separated: public_channel,private_channel,mpim,im (default: public_channel)',
      exclude_archived: 'Exclude archived channels (boolean)',
      limit: 'Max results per page (number, default 100, max 999)',
      cursor: 'Pagination cursor',
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: true,
    docs_url: docsUrl('conversations.list'),
  },
  'conversations.history': {
    description: 'Fetches message history from a conversation.',
    required_params: {
      channel: 'Channel ID',
    },
    optional_params: {
      limit: 'Max messages per page (number, default 100, max 999)',
      cursor: 'Pagination cursor',
      oldest: 'Start of time range (Unix timestamp string)',
      latest: 'End of time range (Unix timestamp string)',
      inclusive: 'Include messages with oldest/latest timestamps (boolean)',
      include_all_metadata: 'Include event metadata (boolean)',
    },
    supports_pagination: true,
    docs_url: docsUrl('conversations.history'),
  },
  'conversations.create': {
    description: 'Creates a new public or private channel.',
    required_params: {
      name: 'Channel name',
    },
    optional_params: {
      is_private: 'Create as private channel (boolean)',
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: false,
    docs_url: docsUrl('conversations.create'),
  },
  'conversations.invite': {
    description: 'Invites users to a channel.',
    required_params: {
      channel: 'Channel ID',
      users: 'Comma-separated user IDs (max 1000)',
    },
    optional_params: {
      force: 'Skip invalid user IDs instead of failing (boolean)',
    },
    supports_pagination: false,
    docs_url: docsUrl('conversations.invite'),
  },
  'conversations.info': {
    description: 'Gets information about a channel.',
    required_params: {
      channel: 'Channel ID',
    },
    optional_params: {
      include_locale: 'Include locale info (boolean)',
      include_num_members: 'Include member count (boolean)',
    },
    supports_pagination: false,
    docs_url: docsUrl('conversations.info'),
  },
  'conversations.members': {
    description: 'Lists members of a conversation.',
    required_params: {
      channel: 'Channel ID',
    },
    optional_params: {
      limit: 'Max results per page (number, default 100, max 999)',
      cursor: 'Pagination cursor',
    },
    supports_pagination: true,
    docs_url: docsUrl('conversations.members'),
  },
  'conversations.replies': {
    description: 'Fetches a thread of messages.',
    required_params: {
      channel: 'Channel ID',
      ts: 'Timestamp of parent message',
    },
    optional_params: {
      limit: 'Max messages per page (number, default 100, max 999)',
      cursor: 'Pagination cursor',
      oldest: 'Start of time range (Unix timestamp string)',
      latest: 'End of time range (Unix timestamp string)',
      inclusive: 'Include oldest/latest messages (boolean)',
    },
    supports_pagination: true,
    docs_url: docsUrl('conversations.replies'),
  },
  'conversations.join': {
    description: 'Joins an existing public channel.',
    required_params: {
      channel: 'Channel ID',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('conversations.join'),
  },
  'conversations.archive': {
    description: 'Archives a channel.',
    required_params: {
      channel: 'Channel ID',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('conversations.archive'),
  },
  'reactions.add': {
    description: 'Adds an emoji reaction to a message.',
    required_params: {
      channel: 'Channel ID containing the message',
      name: 'Emoji name without colons (e.g., thumbsup)',
      timestamp: 'Timestamp of the message',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('reactions.add'),
  },
  'reactions.remove': {
    description: 'Removes an emoji reaction from a message.',
    required_params: {
      channel: 'Channel ID containing the message',
      name: 'Emoji name without colons',
      timestamp: 'Timestamp of the message',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('reactions.remove'),
  },
  'reactions.list': {
    description: 'Lists emoji reactions made by a user.',
    required_params: {},
    optional_params: {
      user: 'User ID (defaults to authed user)',
      cursor: 'Pagination cursor',
      limit: 'Max results per page (number)',
      full: 'Return full reaction objects (boolean)',
    },
    supports_pagination: true,
    docs_url: docsUrl('reactions.list'),
  },
  'users.list': {
    description: 'Lists all users in a workspace.',
    required_params: {},
    optional_params: {
      cursor: 'Pagination cursor',
      limit: 'Max results per page (number, recommended max 200)',
      include_locale: 'Include locale info (boolean)',
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: true,
    docs_url: docsUrl('users.list'),
  },
  'users.info': {
    description: 'Gets information about a single user.',
    required_params: {
      user: 'User ID (e.g., U1234567890)',
    },
    optional_params: {
      include_locale: 'Include locale info (boolean)',
    },
    supports_pagination: false,
    docs_url: docsUrl('users.info'),
  },
  'users.lookupByEmail': {
    description: 'Finds a user by email address.',
    required_params: {
      email: 'Email address',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('users.lookupByEmail'),
  },
  'files.upload': {
    description: 'Uploads a file to Slack.',
    required_params: {},
    optional_params: {
      content: 'File content as string',
      channels: 'Comma-separated channel IDs to share to',
      filename: 'Filename',
      filetype: 'File type identifier',
      title: 'Title of the file',
      initial_comment: 'Message to post with the file',
      thread_ts: 'Thread timestamp to upload into',
    },
    supports_pagination: false,
    deprecated: 'Deprecated since Nov 2025. Use files.getUploadURLExternal + files.completeUploadExternal instead.',
    docs_url: docsUrl('files.upload'),
  },
  'files.getUploadURLExternal': {
    description: 'Gets an external URL to upload a file to (step 1 of file upload).',
    required_params: {
      filename: 'Name of the file',
      length: 'File size in bytes (number)',
    },
    optional_params: {
      alt_txt: 'Alt text for the file',
      snippet_type: 'Snippet type',
    },
    supports_pagination: false,
    docs_url: docsUrl('files.getUploadURLExternal'),
  },
  'files.completeUploadExternal': {
    description: 'Completes a file upload started with files.getUploadURLExternal (step 2 of file upload).',
    required_params: {
      files: 'Array of {id, title?} objects (JSON string)',
    },
    optional_params: {
      channel_id: 'Channel ID to share the file to',
      initial_comment: 'Message to post with the file',
      thread_ts: 'Thread timestamp',
    },
    supports_pagination: false,
    docs_url: docsUrl('files.completeUploadExternal'),
  },
  'pins.add': {
    description: 'Pins a message to a channel.',
    required_params: {
      channel: 'Channel ID',
      timestamp: 'Timestamp of the message to pin',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('pins.add'),
  },
  'pins.remove': {
    description: 'Removes a pin from a channel.',
    required_params: {
      channel: 'Channel ID',
      timestamp: 'Timestamp of the pinned message',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('pins.remove'),
  },
  'bookmarks.add': {
    description: 'Adds a bookmark to a channel.',
    required_params: {
      channel_id: 'Channel ID',
      title: 'Bookmark title',
      type: 'Bookmark type (currently only "link")',
    },
    optional_params: {
      link: 'URL for the bookmark',
      emoji: 'Emoji for the bookmark',
    },
    supports_pagination: false,
    docs_url: docsUrl('bookmarks.add'),
  },
  'reminders.add': {
    description: 'Creates a reminder.',
    required_params: {
      text: 'Reminder text',
      time: 'When to remind (Unix timestamp, seconds from now, or natural language)',
    },
    optional_params: {
      user: 'User to remind (defaults to authed user)',
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: false,
    docs_url: docsUrl('reminders.add'),
  },
  'reminders.list': {
    description: 'Lists all reminders for the authenticated user.',
    required_params: {},
    optional_params: {
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: false,
    docs_url: docsUrl('reminders.list'),
  },
};

export function getMethodMetadata(method: string): MethodMetadata {
  const meta = METHOD_METADATA[method];
  if (meta) return meta;

  return {
    description: `No detailed documentation available for '${method}'. Refer to the Slack API docs.`,
    required_params: {},
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl(method),
  };
}
