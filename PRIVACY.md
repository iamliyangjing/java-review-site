# Privacy

The desktop app stores questions, review schedules, review history, and settings in a SQLite database in the current Windows user's application data directory.

The app does not send telemetry or upload data automatically. Network access is used only after the user initiates a Supabase configuration, authentication, backup, or restore action. Cloud backup requires the user's own Supabase project and retains up to 10 snapshots per account.

When the app crashes, diagnostic details remain local. The user may choose to export a diagnostic JSON file. It contains app/runtime versions, operating system and architecture, event name, and a shortened sanitized error/stack. It does not include the question bank, SQLite database, email, password, Supabase key, or authentication token. Review the exported file before choosing to send it to maintainers.

Local JSON exports and crash diagnostics are written only to a path selected by the user. Local database backups are stored alongside the database in the app data directory.
