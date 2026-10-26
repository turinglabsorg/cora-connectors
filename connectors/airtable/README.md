# Airtable

Connects to the official `https://mcp.airtable.com/mcp` endpoint using the official MCP SDK. Supports these documented read tools only: `list_records_for_table`, `search_records`, `get_table_schema`, `list_tables_for_base`. All other names are denied before dispatch, regardless of upstream annotations.

Create an Airtable PAT with read scopes appropriate to the tools (`data.records:read`, `schema.bases:read`) and grants limited to the intended bases. Set `secretEnv` to its environment variable name. Never place a token in JSON. Separate tokens provide separate resource grants for separate connections. The host may supply an existing OAuth bearer token, but this package does not implement the OAuth flow or token refresh.

Call `createAirtable(connection)`, then `listTools()` to discover current upstream input schemas and `call(name, arguments)` to read. Finally call `close()`. Input schemas are returned from upstream rather than guessed; the upstream server validates calls. Connection-scoped resource permissions are enforced by Airtable's token grants.

Airtable live validation requires an explicitly provisioned Cora test token; unrelated project credentials must not be reused. Local integration tests exercise a real MCP server with fictional records.
