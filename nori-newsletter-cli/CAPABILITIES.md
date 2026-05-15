Newsletter CLI for managing contacts and sending newsletters via AWS SES.
- Initialize SES contact lists and topics
- Add, remove, list, and import subscribers (CSV batch import supported)
- Send HTML newsletters with automatic rate throttling (80% of SES quota)
- Test sends to specific addresses with --test flag
- Preview sends with --dry-run
- Built-in unsubscribe handling via SES managed headers
