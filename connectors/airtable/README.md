# Airtable

Connects to the official `https://mcp.airtable.com/mcp` endpoint using the official MCP SDK. Read tools: `list_bases`, `search_bases`, `list_records_for_table`, `search_records`, `get_table_schema`, `list_tables_for_base`. Record write tools: `create_records_for_table`, `update_records_for_table`, `delete_records_for_table` (including the upstream update tool's upsert option). Unknown tools are denied before dispatch, regardless of upstream annotations.

Create a dedicated Airtable PAT with `data.records:read` and `schema.bases:read`; add `data.records:write` when record mutations are authorized. Restrict grants to intended bases. Set `secretEnv` to its injected environment variable name. Never place a token in JSON. Separate tokens provide separate resource grants for separate connections. The host may supply an OAuth bearer token, but this package does not implement the OAuth flow or token refresh.

Connection `permissions` independently authorize `read` and `write`. Both, either one, or neither can be configured; neither causes initialization to fail. `listTools()` returns only the connection's permitted schemas. `call(name, arguments)` checks the local allowlist and permission on every call. `close()` releases the MCP client. Input schemas come from upstream; the provider validates calls. Airtable enforces token resource grants.

The MCP host exposes `<connection>_tools` for discovery, `<connection>_call` for reads and `<connection>_write` for mutations. Only explicitly configured permissions expose each execution tool. Mutation tools have `readOnlyHint: false` and `destructiveHint: true`; these annotations supplement runtime authorization.

Live validation requires an explicitly provisioned Cora test credential and a disposable test base. See the root README for the opt-in record lifecycle script. HTTP integration tests cover read-only, write-only and combined permissions, including rejected tools and actual fixture state changes.
