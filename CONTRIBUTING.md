# Contributing

Use Node.js 22 or newer. Run `npm ci --ignore-scripts` and `npm test`.
Add each service under `connectors/<service>/` with a manifest, README, integration code and integration tests. Prefer official remote MCP services when available. Keep the core small.

Tests must use fictional data and isolated HTTP or MCP servers. Verify denied permissions, unknown accounts, upstream errors, cross-account responses and credential redaction. Never commit service responses or private connection files.
