import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ConnectorError, connectionSchema, external, requireRead } from '../../packages/core/index.js';

export const READ_TOOLS = Object.freeze(['list_records_for_table', 'search_records', 'get_table_schema', 'list_tables_for_base']);

export async function createAirtable(input, { env = process.env, transport } = {}) {
  const connection = connectionSchema.parse(input);
  if (connection.connector !== 'airtable' || !connection.secretEnv || connection.url) throw new ConnectorError('INVALID_CONNECTION');
  requireRead(connection);
  const token = env[connection.secretEnv];
  if (!token) throw new ConnectorError('AUTH_REQUIRED');
  const client = new Client({ name: 'cora-connectors', version: '0.1.0' });
  try {
    await client.connect(transport ?? new StreamableHTTPClientTransport(new URL('https://mcp.airtable.com/mcp'), { requestInit: { headers: { Authorization: `Bearer ${token}` }, redirect: 'error' } }));
  } catch {
    await client.close().catch(() => {});
    throw new ConnectorError('UPSTREAM_UNAVAILABLE');
  }
  return {
    id: connection.id,
    async listTools() {
      requireRead(connection);
      try {
        const tools = [];
        let cursor;
        const cursors = new Set();
        let pages = 0;
        do {
          if (++pages > 20 || (cursor && cursors.has(cursor))) throw new ConnectorError('INVALID_RESPONSE');
          if (cursor) cursors.add(cursor);
          const page = await client.listTools(cursor ? { cursor } : {});
          tools.push(...page.tools.filter(tool => READ_TOOLS.includes(tool.name)).map(({ name, inputSchema }) => ({ name, inputSchema })));
          if (page.nextCursor === cursor && cursor) throw new ConnectorError('INVALID_RESPONSE');
          cursor = page.nextCursor;
          if (tools.length > 100) throw new ConnectorError('INVALID_RESPONSE');
        } while (cursor);
        return external(tools);
      } catch { throw new ConnectorError('UPSTREAM_UNAVAILABLE'); }
    },
    async call(name, args) {
      requireRead(connection);
      if (!READ_TOOLS.includes(name)) throw new ConnectorError('PERMISSION_DENIED');
      try {
        const result = await client.callTool({ name, arguments: args });
        if (result.isError) throw new ConnectorError('UPSTREAM_TOOL_ERROR');
        return external(result);
      } catch (error) {
        if (error instanceof ConnectorError) throw error;
        throw new ConnectorError('UPSTREAM_UNAVAILABLE');
      }
    },
    async close() { await client.close(); },
  };
}
