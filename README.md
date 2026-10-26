# cora-connectors

Portable agent capabilities for Cora, with one service per folder and an MCP interface usable by other hosts. The first version provides **read-only Milo email tools** and a **read/write bridge to Airtable's official MCP server**.

## Quick start

Requires Node.js 22+.

```sh
npm ci --ignore-scripts
npm test
cp examples/connections.example.json connections.local.json
# Set your private Milo origin and account ID in connections.local.json.
CORA_CONNECTIONS_FILE="$PWD/connections.local.json" npm start
```

Use an absolute path in MCP host configuration:

```json
{
  "mcpServers": {
    "cora-connectors": {
      "command": "node",
      "args": ["/absolute/path/cora-connectors/packages/mcp/stdio.js"],
      "env": { "CORA_CONNECTIONS_FILE": "/private/path/connections.local.json" }
    }
  }
}
```

Use `examples/airtable.example.json` for Airtable and inject `AIRTABLE_TOKEN` through your secret manager. No token value belongs in a connection file. For example, with an already-provisioned Hush vault item named `CORA_AIRTABLE_TOKEN`:

```sh
CORA_CONNECTIONS_FILE="$PWD/connections.local.json" hush run --name CORA_AIRTABLE_TOKEN --env AIRTABLE_TOKEN --redact -- node packages/mcp/stdio.js
```

A connector is public code; a connection is private configuration. Each Milo connection is bound to a single mailbox. Airtable resources are restricted using the token's grants. Each configured connection gets its own tool prefix, such as `mail_search` and `mail_read`. Run separate processes for different owners or agent policies.

## Layout

```text
connectors/airtable/    Official remote MCP integration and manifest
connectors/milo/        Milo HTTP integration and manifest
packages/core/         Validation, permission checks, error codes
packages/mcp/          MCP server and stdio entrypoint
packages/testing/      Isolated HTTP fixtures
examples/              Placeholder configuration only
scripts/               Explicit opt-in live checks
```

The provider modules can also be imported directly by Cora. This repository does not yet install or enable tools inside Cora; runtime integration and public OAuth onboarding are separate host work. Airtable record creation, update and deletion require an explicit `write` permission; read operations require `read`. The MCP adapter exposes a separate `<connection>_write` tool with mutation annotations. Milo remains read-only; email sending is not implemented.

Read [architecture](docs/architecture.md), [security](SECURITY.md), [Milo](connectors/milo/README.md) and [Airtable](connectors/airtable/README.md) before configuring real data. See [contributing](CONTRIBUTING.md) to add a connector.

## Verification

`npm test` runs isolated HTTP and MCP integration tests with fictional data. `MILO_URL=<private-origin> npm run test:live:milo` explicitly tests a real Milo service, prints only pass/fail summaries and requires two distinct configured accounts. Never publish private account IDs, messages or credentials in test output.

For an explicitly provisioned, disposable Airtable test base, inject `CORA_AIRTABLE_TOKEN` and set `CORA_AIRTABLE_TEST_BASE`, `CORA_AIRTABLE_TEST_TABLE` and `CORA_AIRTABLE_TEST_FIELD` (a writable text field ID). Run `CORA_AIRTABLE_ALLOW_TEST_WRITES=true npm run test:live:airtable`. This opt-in script creates one uniquely marked record, verifies reads and updates, checks read-only mutation denial, then deletes only its own record and verifies absence. Never run it against a customer base.
