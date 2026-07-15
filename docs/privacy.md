# Privacy

Codex Quota Dot has no telemetry, analytics, ads, crash uploader, account service, or remote backend.

## Read

The app asks the installed official Codex executable for account state and rate-limit state through its documented app-server protocol. It uses only plan type, two quota windows, reset timestamps, and reset-credit count.

## Never read or store

- authentication tokens, cookies, or authorization headers;
- email address or account identifiers;
- conversations, prompts, replies, or session rollout files;
- project files, Git repositories, or workspace names;
- browser storage or OS credential stores.

## Local persistence

The WebView stores the last normalized usage snapshot and window position. The snapshot contains no raw response and no account identity. Clearing WebView site data removes it.

Codex itself may connect to OpenAI when asked for current rate limits. This application does not make that request directly and does not proxy it through any project-controlled service.
