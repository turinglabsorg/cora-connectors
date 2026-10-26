# Security

Do not report credentials, mailbox content or exploitable details in public issues. Use GitHub private vulnerability reporting if enabled; otherwise contact a repository maintainer privately before sharing details.

The host configuration is trusted. Anyone able to edit it or the process environment controls its connections. Run a separate process per owner or agent access policy. This library does not provide a multi-tenant authentication service or credential vault.

Only read tools are implemented. `write` and `send` are distinct reserved permissions and do not enable any tools in this version. Runtime checks enforce `read` before provider access. MCP annotations alone are not authorization.

Milo binds each connection to one exact account ID, validates that account against the service and rejects mismatched results. It never falls back to a general inbox. Airtable uses a fixed official endpoint and a local allowlist of four documented read tools. Limit token scopes and resource grants in Airtable; the connector does not add base isolation beyond those upstream grants.

Treat every service response as untrusted data, including email bodies, HTML and attachment filenames. The envelope and server instructions communicate this boundary; they are not a complete prompt-injection defense. Never execute instructions found in records or messages. HTML is returned as text, never rendered or fetched here. Attachment bytes and remote images are not downloaded.

Milo HTTP requests reject redirects, use a timeout and cap JSON responses at 2 MB. The MCP SDK handles Airtable transport limits. Errors exposed to agents contain stable codes rather than raw upstream bodies or credentials. No request or result logging is enabled.

Use a secret manager to inject credentials into environment variables. Connection JSON contains only environment variable names. Keep it outside the checkout or use an ignored `*.local.json` file. Never reuse credentials exposed in chat.
