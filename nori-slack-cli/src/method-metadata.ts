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
  // --- api ---
  'api.test': {
    description: 'Checks API calling code. Does not require authentication.',
    required_params: {},
    optional_params: {
      foo: 'Any parameter — all params are echoed back in the response',
    },
    supports_pagination: false,
    docs_url: docsUrl('api.test'),
  },
  // --- assistant ---
  'assistant.threads.setStatus': {
    description: 'Sets the status for an AI assistant thread.',
    required_params: {
      channel_id: 'Channel ID of the assistant thread',
      thread_ts: 'Timestamp of the thread',
      status: 'Status text to display',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('assistant.threads.setStatus'),
  },
  'assistant.threads.setSuggestedPrompts': {
    description: 'Sets suggested prompts for an AI assistant thread.',
    required_params: {
      channel_id: 'Channel ID of the assistant thread',
      thread_ts: 'Timestamp of the thread',
    },
    optional_params: {
      prompts: 'Array of {title, message} prompt objects (JSON string)',
    },
    supports_pagination: false,
    docs_url: docsUrl('assistant.threads.setSuggestedPrompts'),
  },
  'assistant.threads.setTitle': {
    description: 'Sets the title for an AI assistant thread.',
    required_params: {
      channel_id: 'Channel ID of the assistant thread',
      thread_ts: 'Timestamp of the thread',
      title: 'Title text for the thread',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('assistant.threads.setTitle'),
  },
  // --- auth ---
  'auth.revoke': {
    description: 'Revokes the current token.',
    required_params: {},
    optional_params: {
      test: 'If true, does not actually revoke the token (boolean)',
    },
    supports_pagination: false,
    docs_url: docsUrl('auth.revoke'),
  },
  'auth.teams.list': {
    description: 'Lists the workspaces a token can access.',
    required_params: {},
    optional_params: {
      cursor: 'Pagination cursor',
      limit: 'Max results per page (number)',
    },
    supports_pagination: true,
    docs_url: docsUrl('auth.teams.list'),
  },
  'auth.test': {
    description: 'Checks authentication and returns identity information.',
    required_params: {},
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('auth.test'),
  },
  // --- bookmarks ---
  'bookmarks.edit': {
    description: 'Edits an existing bookmark in a channel.',
    required_params: {
      bookmark_id: 'Bookmark ID',
      channel_id: 'Channel ID',
    },
    optional_params: {
      emoji: 'Emoji for the bookmark',
      link: 'URL for the bookmark',
      title: 'New title',
    },
    supports_pagination: false,
    docs_url: docsUrl('bookmarks.edit'),
  },
  'bookmarks.list': {
    description: 'Lists bookmarks for a channel.',
    required_params: {
      channel_id: 'Channel ID',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('bookmarks.list'),
  },
  'bookmarks.remove': {
    description: 'Removes a bookmark from a channel.',
    required_params: {
      bookmark_id: 'Bookmark ID',
      channel_id: 'Channel ID',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('bookmarks.remove'),
  },
  // --- bots ---
  'bots.info': {
    description: 'Gets information about a bot user.',
    required_params: {},
    optional_params: {
      bot: 'Bot user ID',
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: false,
    docs_url: docsUrl('bots.info'),
  },
  // --- calls ---
  'calls.add': {
    description: 'Registers a new Slack call.',
    required_params: {
      external_unique_id: 'Unique ID from the calling provider',
      join_url: 'URL for users to join the call',
    },
    optional_params: {
      created_by: 'User ID of the call creator',
      date_start: 'Unix timestamp of call start',
      desktop_app_join_url: 'URL for desktop app join',
      external_display_id: 'Display ID shown to users',
      title: 'Call title',
      users: 'Array of {slack_id} or {external_id, display_name, avatar_url} objects (JSON string)',
    },
    supports_pagination: false,
    docs_url: docsUrl('calls.add'),
  },
  'calls.end': {
    description: 'Ends a registered Slack call.',
    required_params: {
      id: 'Call ID returned by calls.add',
    },
    optional_params: {
      duration: 'Call duration in seconds (number)',
    },
    supports_pagination: false,
    docs_url: docsUrl('calls.end'),
  },
  'calls.info': {
    description: 'Gets information about a registered Slack call.',
    required_params: {
      id: 'Call ID',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('calls.info'),
  },
  'calls.participants.add': {
    description: 'Adds participants to a Slack call.',
    required_params: {
      id: 'Call ID',
      users: 'Array of {slack_id} or {external_id, display_name, avatar_url} objects (JSON string)',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('calls.participants.add'),
  },
  'calls.participants.remove': {
    description: 'Removes participants from a Slack call.',
    required_params: {
      id: 'Call ID',
      users: 'Array of {slack_id} or {external_id, display_name} objects (JSON string)',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('calls.participants.remove'),
  },
  'calls.update': {
    description: 'Updates a registered Slack call.',
    required_params: {
      id: 'Call ID',
    },
    optional_params: {
      desktop_app_join_url: 'URL for desktop app join',
      join_url: 'URL for users to join the call',
      title: 'New call title',
    },
    supports_pagination: false,
    docs_url: docsUrl('calls.update'),
  },
  // --- canvases ---
  'canvases.access.delete': {
    description: 'Removes access to a canvas for specified users or channels.',
    required_params: {
      canvas_id: 'Canvas ID',
    },
    optional_params: {
      channel_ids: 'Array of channel IDs (JSON string)',
      user_ids: 'Array of user IDs (JSON string)',
    },
    supports_pagination: false,
    docs_url: docsUrl('canvases.access.delete'),
  },
  'canvases.access.set': {
    description: 'Sets access level to a canvas for specified users or channels.',
    required_params: {
      canvas_id: 'Canvas ID',
      access_level: 'Access level: can_view, can_edit',
    },
    optional_params: {
      channel_ids: 'Array of channel IDs (JSON string)',
      user_ids: 'Array of user IDs (JSON string)',
    },
    supports_pagination: false,
    docs_url: docsUrl('canvases.access.set'),
  },
  'canvases.create': {
    description: 'Creates a canvas.',
    required_params: {},
    optional_params: {
      title: 'Canvas title',
      document_content: 'Document content object with type and markdown (JSON string)',
    },
    supports_pagination: false,
    docs_url: docsUrl('canvases.create'),
  },
  'canvases.delete': {
    description: 'Deletes a canvas.',
    required_params: {
      canvas_id: 'Canvas ID',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('canvases.delete'),
  },
  'canvases.edit': {
    description: 'Edits a canvas by applying operations.',
    required_params: {
      canvas_id: 'Canvas ID',
      changes: 'Array of change operations (JSON string)',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('canvases.edit'),
  },
  'canvases.sections.lookup': {
    description: 'Looks up sections in a canvas.',
    required_params: {
      canvas_id: 'Canvas ID',
      criteria: 'Lookup criteria object (JSON string)',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('canvases.sections.lookup'),
  },
  // --- chat (remaining) ---
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
  'chat.deleteScheduledMessage': {
    description: 'Deletes a scheduled message before it is sent.',
    required_params: {
      channel: 'Channel ID',
      scheduled_message_id: 'ID of the scheduled message (from chat.scheduleMessage)',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('chat.deleteScheduledMessage'),
  },
  'chat.getPermalink': {
    description: 'Gets a permalink URL for a specific message.',
    required_params: {
      channel: 'Channel ID',
      message_ts: 'Timestamp of the message',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('chat.getPermalink'),
  },
  'chat.meMessage': {
    description: 'Sends a /me message to a channel.',
    required_params: {
      channel: 'Channel ID',
      text: 'Message text',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('chat.meMessage'),
  },
  'chat.postEphemeral': {
    description: 'Sends an ephemeral message visible only to a specific user in a channel.',
    required_params: {
      channel: 'Channel ID',
      user: 'User ID who will see the message',
    },
    optional_params: {
      text: 'Message text (required if no blocks/attachments)',
      blocks: 'Array of Block Kit blocks (JSON string)',
      attachments: 'Array of attachments (JSON string)',
      thread_ts: 'Thread timestamp to post in',
    },
    supports_pagination: false,
    docs_url: docsUrl('chat.postEphemeral'),
  },
  'chat.scheduleMessage': {
    description: 'Schedules a message to be sent at a specific time.',
    required_params: {
      channel: 'Channel ID',
      post_at: 'Unix timestamp for when to send the message',
    },
    optional_params: {
      text: 'Message text (required if no blocks/attachments)',
      blocks: 'Array of Block Kit blocks (JSON string)',
      attachments: 'Array of attachments (JSON string)',
      thread_ts: 'Thread timestamp to schedule into',
      unfurl_links: 'Enable URL unfurling (boolean)',
      unfurl_media: 'Enable media unfurling (boolean)',
    },
    supports_pagination: false,
    docs_url: docsUrl('chat.scheduleMessage'),
  },
  'chat.scheduledMessages.list': {
    description: 'Lists scheduled messages for the calling user in a team.',
    required_params: {},
    optional_params: {
      channel: 'Channel ID to filter by',
      cursor: 'Pagination cursor',
      latest: 'Latest scheduled time (Unix timestamp)',
      limit: 'Max results per page (number)',
      oldest: 'Oldest scheduled time (Unix timestamp)',
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: true,
    docs_url: docsUrl('chat.scheduledMessages.list'),
  },
  'chat.unfurl': {
    description: 'Provides custom unfurl behavior for URLs in messages.',
    required_params: {
      channel: 'Channel ID',
      ts: 'Timestamp of the message with the URL',
      unfurls: 'Map of URLs to unfurl attachment objects (JSON string)',
    },
    optional_params: {
      user_auth_message: 'Message to show if user auth is needed',
      user_auth_required: 'Whether user auth is required (boolean)',
      user_auth_url: 'URL to direct user to for auth',
    },
    supports_pagination: false,
    docs_url: docsUrl('chat.unfurl'),
  },
  // --- conversations (remaining) ---
  'conversations.acceptSharedInvite': {
    description: 'Accepts a Slack Connect channel invite.',
    required_params: {
      channel_name: 'Name for the local channel',
    },
    optional_params: {
      channel_id: 'Channel ID from the invite',
      free_trial_accepted: 'Accept free trial (boolean)',
      invite_id: 'Invite ID from the shared invite',
      is_private: 'Create as private channel (boolean)',
      team_id: 'Team ID',
    },
    supports_pagination: false,
    docs_url: docsUrl('conversations.acceptSharedInvite'),
  },
  'conversations.approveSharedInvite': {
    description: 'Approves a Slack Connect channel invite.',
    required_params: {
      invite_id: 'Invite ID to approve',
    },
    optional_params: {
      target_team: 'Target team ID',
    },
    supports_pagination: false,
    docs_url: docsUrl('conversations.approveSharedInvite'),
  },
  'conversations.canvases.create': {
    description: 'Creates a canvas in a conversation.',
    required_params: {
      channel_id: 'Channel ID',
    },
    optional_params: {
      document_content: 'Document content with type and markdown (JSON string)',
    },
    supports_pagination: false,
    docs_url: docsUrl('conversations.canvases.create'),
  },
  'conversations.close': {
    description: 'Closes a direct message or multi-party direct message.',
    required_params: {
      channel: 'DM or MPDM channel ID',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('conversations.close'),
  },
  'conversations.declineSharedInvite': {
    description: 'Declines a Slack Connect channel invite.',
    required_params: {
      invite_id: 'Invite ID to decline',
    },
    optional_params: {
      target_team: 'Target team ID',
    },
    supports_pagination: false,
    docs_url: docsUrl('conversations.declineSharedInvite'),
  },
  'conversations.inviteShared': {
    description: 'Sends an invite to a Slack Connect channel.',
    required_params: {
      channel: 'Channel ID',
    },
    optional_params: {
      emails: 'Comma-separated email addresses',
      external_limited: 'Whether invited users are external limited (boolean)',
      user_ids: 'Comma-separated user IDs',
    },
    supports_pagination: false,
    docs_url: docsUrl('conversations.inviteShared'),
  },
  'conversations.kick': {
    description: 'Removes a user from a conversation.',
    required_params: {
      channel: 'Channel ID',
      user: 'User ID to remove',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('conversations.kick'),
  },
  'conversations.leave': {
    description: 'Leaves a conversation.',
    required_params: {
      channel: 'Channel ID',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('conversations.leave'),
  },
  'conversations.listConnectInvites': {
    description: 'Lists Slack Connect channel invites.',
    required_params: {},
    optional_params: {
      count: 'Max results (number)',
      cursor: 'Pagination cursor',
      team_id: 'Team ID',
    },
    supports_pagination: false,
    docs_url: docsUrl('conversations.listConnectInvites'),
  },
  'conversations.mark': {
    description: 'Sets the read cursor in a channel.',
    required_params: {
      channel: 'Channel ID',
      ts: 'Timestamp to mark as read up to',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('conversations.mark'),
  },
  'conversations.open': {
    description: 'Opens or resumes a direct message or multi-party direct message.',
    required_params: {},
    optional_params: {
      channel: 'DM channel ID to resume',
      return_im: 'Return full IM object (boolean)',
      users: 'Comma-separated user IDs to open a DM with',
    },
    supports_pagination: false,
    docs_url: docsUrl('conversations.open'),
  },
  'conversations.rename': {
    description: 'Renames a conversation.',
    required_params: {
      channel: 'Channel ID',
      name: 'New channel name',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('conversations.rename'),
  },
  'conversations.setPurpose': {
    description: 'Sets the purpose of a conversation.',
    required_params: {
      channel: 'Channel ID',
      purpose: 'New purpose text',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('conversations.setPurpose'),
  },
  'conversations.setTopic': {
    description: 'Sets the topic of a conversation.',
    required_params: {
      channel: 'Channel ID',
      topic: 'New topic text',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('conversations.setTopic'),
  },
  'conversations.unarchive': {
    description: 'Reverses a conversation archive.',
    required_params: {
      channel: 'Channel ID',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('conversations.unarchive'),
  },
  // --- dialog ---
  'dialog.open': {
    description: 'Opens a dialog with a user. Requires a trigger_id from an interactive action.',
    required_params: {
      trigger_id: 'Trigger ID from a user interaction (expires in 3 seconds)',
      dialog: 'Dialog definition object (JSON string)',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('dialog.open'),
  },
  // --- dnd ---
  'dnd.endDnd': {
    description: 'Ends the current Do Not Disturb session immediately.',
    required_params: {},
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('dnd.endDnd'),
  },
  'dnd.endSnooze': {
    description: 'Ends the current snooze mode immediately.',
    required_params: {},
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('dnd.endSnooze'),
  },
  'dnd.info': {
    description: 'Gets Do Not Disturb status for a user.',
    required_params: {},
    optional_params: {
      user: 'User ID (defaults to authed user)',
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: false,
    docs_url: docsUrl('dnd.info'),
  },
  'dnd.setSnooze': {
    description: 'Turns on Do Not Disturb mode for the current user.',
    required_params: {
      num_minutes: 'Number of minutes to snooze (number)',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('dnd.setSnooze'),
  },
  'dnd.teamInfo': {
    description: 'Gets Do Not Disturb status for multiple users on a team.',
    required_params: {
      users: 'Comma-separated user IDs',
    },
    optional_params: {
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: false,
    docs_url: docsUrl('dnd.teamInfo'),
  },
  // --- emoji ---
  'emoji.list': {
    description: 'Lists custom emoji for a team.',
    required_params: {},
    optional_params: {
      include_categories: 'Include emoji categories (boolean)',
    },
    supports_pagination: false,
    docs_url: docsUrl('emoji.list'),
  },
  // --- files (remaining) ---
  'files.comments.delete': {
    description: 'Deletes a comment from a file.',
    required_params: {
      file: 'File ID',
      id: 'Comment ID',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('files.comments.delete'),
  },
  'files.delete': {
    description: 'Deletes a file.',
    required_params: {
      file: 'File ID',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('files.delete'),
  },
  'files.info': {
    description: 'Gets information about a file.',
    required_params: {
      file: 'File ID',
    },
    optional_params: {
      count: 'Number of comments per page (number)',
      cursor: 'Pagination cursor',
      limit: 'Max items per page (number)',
      page: 'Page number (number)',
    },
    supports_pagination: true,
    docs_url: docsUrl('files.info'),
  },
  'files.list': {
    description: 'Lists files visible to the current user.',
    required_params: {},
    optional_params: {
      channel: 'Channel ID to filter by',
      count: 'Number of files per page (number)',
      page: 'Page number (number)',
      ts_from: 'Filter files created after this Unix timestamp',
      ts_to: 'Filter files created before this Unix timestamp',
      types: 'Filter by file type: all, spaces, snippets, images, gdocs, zips, pdfs',
      user: 'User ID to filter by',
    },
    supports_pagination: false,
    docs_url: docsUrl('files.list'),
  },
  'files.remote.add': {
    description: 'Adds a remote file to Slack.',
    required_params: {
      external_id: 'Unique ID for the file in the external system',
      external_url: 'URL of the remote file',
      title: 'Title for the file',
    },
    optional_params: {
      filetype: 'File type identifier',
      indexable_file_contents: 'Searchable text content of the file',
      preview_image: 'Preview image for the file',
    },
    supports_pagination: false,
    docs_url: docsUrl('files.remote.add'),
  },
  'files.remote.info': {
    description: 'Gets information about a remote file.',
    required_params: {},
    optional_params: {
      external_id: 'External ID of the file',
      file: 'File ID',
    },
    supports_pagination: false,
    docs_url: docsUrl('files.remote.info'),
  },
  'files.remote.list': {
    description: 'Lists remote files visible to the current user.',
    required_params: {},
    optional_params: {
      channel: 'Channel ID to filter by',
      cursor: 'Pagination cursor',
      limit: 'Max results per page (number)',
      ts_from: 'Filter files created after this Unix timestamp',
      ts_to: 'Filter files created before this Unix timestamp',
    },
    supports_pagination: true,
    docs_url: docsUrl('files.remote.list'),
  },
  'files.remote.remove': {
    description: 'Removes a remote file from Slack.',
    required_params: {},
    optional_params: {
      external_id: 'External ID of the file',
      file: 'File ID',
    },
    supports_pagination: false,
    docs_url: docsUrl('files.remote.remove'),
  },
  'files.remote.share': {
    description: 'Shares a remote file into a channel.',
    required_params: {
      channels: 'Comma-separated channel IDs to share to',
    },
    optional_params: {
      external_id: 'External ID of the file',
      file: 'File ID',
    },
    supports_pagination: false,
    docs_url: docsUrl('files.remote.share'),
  },
  'files.remote.update': {
    description: 'Updates a remote file.',
    required_params: {},
    optional_params: {
      external_id: 'External ID of the file',
      external_url: 'New URL of the remote file',
      file: 'File ID',
      filetype: 'File type identifier',
      indexable_file_contents: 'Searchable text content',
      preview_image: 'Preview image',
      title: 'New title',
    },
    supports_pagination: false,
    docs_url: docsUrl('files.remote.update'),
  },
  'files.revokePublicURL': {
    description: 'Revokes public/external sharing access for a file.',
    required_params: {
      file: 'File ID',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('files.revokePublicURL'),
  },
  'files.sharedPublicURL': {
    description: 'Enables public/external sharing for a file.',
    required_params: {
      file: 'File ID',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('files.sharedPublicURL'),
  },
  // --- migration ---
  'migration.exchange': {
    description: 'Exchanges legacy user IDs for current IDs across workspaces.',
    required_params: {
      users: 'Comma-separated legacy user IDs',
    },
    optional_params: {
      to_old: 'Convert to old IDs instead (boolean)',
      team_id: 'Team ID',
    },
    supports_pagination: false,
    docs_url: docsUrl('migration.exchange'),
  },
  // --- pins (remaining) ---
  'pins.list': {
    description: 'Lists pinned items in a channel.',
    required_params: {
      channel: 'Channel ID',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('pins.list'),
  },
  // --- reactions (remaining) ---
  'reactions.get': {
    description: 'Gets reactions for a single item (message, file, or file comment).',
    required_params: {},
    optional_params: {
      channel: 'Channel ID (required with timestamp)',
      file: 'File ID',
      file_comment: 'File comment ID',
      full: 'Return full reaction objects (boolean)',
      timestamp: 'Message timestamp (required with channel)',
    },
    supports_pagination: false,
    docs_url: docsUrl('reactions.get'),
  },
  // --- reminders (remaining) ---
  'reminders.complete': {
    description: 'Marks a reminder as complete.',
    required_params: {
      reminder: 'Reminder ID',
    },
    optional_params: {
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: false,
    docs_url: docsUrl('reminders.complete'),
  },
  'reminders.delete': {
    description: 'Deletes a reminder.',
    required_params: {
      reminder: 'Reminder ID',
    },
    optional_params: {
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: false,
    docs_url: docsUrl('reminders.delete'),
  },
  'reminders.info': {
    description: 'Gets information about a reminder.',
    required_params: {
      reminder: 'Reminder ID',
    },
    optional_params: {
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: false,
    docs_url: docsUrl('reminders.info'),
  },
  // --- team ---
  'team.accessLogs': {
    description: 'Gets access logs for the current team.',
    required_params: {},
    optional_params: {
      before: 'End of time range (Unix timestamp)',
      count: 'Number of items per page (number)',
      cursor: 'Pagination cursor',
      limit: 'Max results per page (number)',
      page: 'Page number (number)',
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: true,
    docs_url: docsUrl('team.accessLogs'),
  },
  'team.billableInfo': {
    description: 'Gets billable user information for the current team.',
    required_params: {},
    optional_params: {
      cursor: 'Pagination cursor',
      limit: 'Max results per page (number)',
      team_id: 'Team ID for org-wide apps',
      user: 'User ID to get info for',
    },
    supports_pagination: true,
    docs_url: docsUrl('team.billableInfo'),
  },
  'team.info': {
    description: 'Gets information about the current team.',
    required_params: {},
    optional_params: {
      team: 'Team ID (defaults to current team)',
      domain: 'Team domain',
    },
    supports_pagination: false,
    docs_url: docsUrl('team.info'),
  },
  'team.integrationLogs': {
    description: 'Gets integration activity logs for the current team.',
    required_params: {},
    optional_params: {
      app_id: 'Filter by app ID',
      change_type: 'Filter by change type: added, removed, enabled, disabled, updated',
      count: 'Number of items per page (number)',
      page: 'Page number (number)',
      service_id: 'Filter by service ID',
      team_id: 'Team ID for org-wide apps',
      user: 'Filter by user ID',
    },
    supports_pagination: false,
    docs_url: docsUrl('team.integrationLogs'),
  },
  'team.profile.get': {
    description: 'Gets the profile field definitions for the current team.',
    required_params: {},
    optional_params: {
      visibility: 'Filter by field visibility: all, visible, hidden',
    },
    supports_pagination: false,
    docs_url: docsUrl('team.profile.get'),
  },
  // --- usergroups ---
  'usergroups.create': {
    description: 'Creates a user group.',
    required_params: {
      name: 'Name of the user group',
    },
    optional_params: {
      channels: 'Comma-separated channel IDs to associate',
      description: 'Description of the user group',
      handle: 'Mention handle (e.g., @marketing)',
      include_count: 'Include number of users (boolean)',
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: false,
    docs_url: docsUrl('usergroups.create'),
  },
  'usergroups.disable': {
    description: 'Disables a user group.',
    required_params: {
      usergroup: 'User group ID',
    },
    optional_params: {
      include_count: 'Include number of users (boolean)',
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: false,
    docs_url: docsUrl('usergroups.disable'),
  },
  'usergroups.enable': {
    description: 'Enables a disabled user group.',
    required_params: {
      usergroup: 'User group ID',
    },
    optional_params: {
      include_count: 'Include number of users (boolean)',
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: false,
    docs_url: docsUrl('usergroups.enable'),
  },
  'usergroups.list': {
    description: 'Lists all user groups in the workspace.',
    required_params: {},
    optional_params: {
      include_count: 'Include number of users (boolean)',
      include_disabled: 'Include disabled user groups (boolean)',
      include_users: 'Include member user IDs (boolean)',
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: false,
    docs_url: docsUrl('usergroups.list'),
  },
  'usergroups.update': {
    description: 'Updates an existing user group.',
    required_params: {
      usergroup: 'User group ID',
    },
    optional_params: {
      channels: 'Comma-separated channel IDs',
      description: 'New description',
      handle: 'New mention handle',
      include_count: 'Include number of users (boolean)',
      name: 'New name',
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: false,
    docs_url: docsUrl('usergroups.update'),
  },
  'usergroups.users.list': {
    description: 'Lists users in a user group.',
    required_params: {
      usergroup: 'User group ID',
    },
    optional_params: {
      include_disabled: 'Include disabled users (boolean)',
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: false,
    docs_url: docsUrl('usergroups.users.list'),
  },
  'usergroups.users.update': {
    description: 'Updates the members of a user group.',
    required_params: {
      usergroup: 'User group ID',
      users: 'Comma-separated user IDs for the new member list',
    },
    optional_params: {
      include_count: 'Include number of users (boolean)',
      team_id: 'Team ID for org-wide apps',
    },
    supports_pagination: false,
    docs_url: docsUrl('usergroups.users.update'),
  },
  // --- users (remaining) ---
  'users.conversations': {
    description: 'Lists conversations the calling user or a specified user is a member of.',
    required_params: {},
    optional_params: {
      cursor: 'Pagination cursor',
      exclude_archived: 'Exclude archived channels (boolean)',
      limit: 'Max results per page (number, default 100, max 999)',
      team_id: 'Team ID for org-wide apps',
      types: 'Comma-separated: public_channel,private_channel,mpim,im',
      user: 'User ID (defaults to authed user)',
    },
    supports_pagination: true,
    docs_url: docsUrl('users.conversations'),
  },
  'users.getPresence': {
    description: 'Gets the presence status of a user.',
    required_params: {
      user: 'User ID',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('users.getPresence'),
  },
  'users.profile.get': {
    description: 'Gets a user\'s profile information.',
    required_params: {},
    optional_params: {
      include_labels: 'Include custom profile field labels (boolean)',
      user: 'User ID (defaults to authed user)',
    },
    supports_pagination: false,
    docs_url: docsUrl('users.profile.get'),
  },
  'users.setPresence': {
    description: 'Sets the presence of the authenticated user.',
    required_params: {
      presence: 'Presence status: auto or away',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('users.setPresence'),
  },
  // --- views ---
  'views.open': {
    description: 'Opens a modal view with a user. Requires a trigger_id from an interactive action.',
    required_params: {
      trigger_id: 'Trigger ID from a user interaction (expires in 3 seconds)',
      view: 'View payload object (JSON string)',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('views.open'),
  },
  'views.publish': {
    description: 'Publishes a static view for a user on the Home tab.',
    required_params: {
      user_id: 'User ID to publish the view for',
      view: 'View payload object (JSON string)',
    },
    optional_params: {
      hash: 'Hash from a previous view to detect conflicts',
    },
    supports_pagination: false,
    docs_url: docsUrl('views.publish'),
  },
  'views.push': {
    description: 'Pushes a new view onto the existing view stack.',
    required_params: {
      trigger_id: 'Trigger ID from a user interaction',
      view: 'View payload object (JSON string)',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('views.push'),
  },
  'views.update': {
    description: 'Updates an existing view.',
    required_params: {
      view: 'View payload object (JSON string)',
    },
    optional_params: {
      external_id: 'External ID of the view',
      hash: 'Hash from a previous view to detect conflicts',
      view_id: 'View ID to update',
    },
    supports_pagination: false,
    docs_url: docsUrl('views.update'),
  },
  // --- workflows ---
  'workflows.stepCompleted': {
    description: 'Indicates that a workflow step completed successfully.',
    required_params: {
      workflow_step_execute_id: 'ID from the workflow_step_execute event',
    },
    optional_params: {
      outputs: 'Key-value map of step outputs (JSON string)',
    },
    supports_pagination: false,
    docs_url: docsUrl('workflows.stepCompleted'),
  },
  'workflows.stepFailed': {
    description: 'Indicates that a workflow step failed.',
    required_params: {
      workflow_step_execute_id: 'ID from the workflow_step_execute event',
      error: 'Error message object with message field (JSON string)',
    },
    optional_params: {},
    supports_pagination: false,
    docs_url: docsUrl('workflows.stepFailed'),
  },
  'workflows.updateStep': {
    description: 'Updates the configuration for a workflow step.',
    required_params: {
      workflow_step_edit_id: 'ID from the workflow_step_edit event',
    },
    optional_params: {
      inputs: 'Key-value map of step inputs (JSON string)',
      outputs: 'Array of output definitions (JSON string)',
      step_image_url: 'Image URL for the step',
      step_name: 'Name for the step',
    },
    supports_pagination: false,
    docs_url: docsUrl('workflows.updateStep'),
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
