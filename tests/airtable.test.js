import { test } from 'node:test';
import assert from 'node:assert/strict';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { z } from 'zod';
import { createAirtable } from '../connectors/airtable/index.js';
import { fixture } from '../packages/testing/http.js';

test('Airtable bridge negotiates MCP over HTTP, filters tools and blocks mutations', async t => {
  let writes = 0;
  const f = await fixture(async (url, req, res) => {
    if (req.headers.authorization !== 'Bearer fictional-test-token') { res.statusCode = 401; return res.end('{}'); }
    const server = new McpServer({ name: 'fictional-airtable', version: '1' });
    server.registerTool('search_records', { inputSchema: { query: z.string() } }, async ({ query }) => ({ content: [{ type: 'text', text: JSON.stringify({ records: [{ id: 'rec-example', query }] }) }] }));
    server.registerTool('create_records_for_table', { inputSchema: {} }, async () => { writes++; return { content: [] }; });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    res.on('close', () => { void transport.close(); void server.close(); });
    await transport.handleRequest(req, res);
  }); t.after(() => f.close());
  const transport = new StreamableHTTPClientTransport(new URL('/mcp', f.url), { requestInit: { headers: { Authorization: 'Bearer fictional-test-token' } } });
  const c = await createAirtable({ id: 'crm', connector: 'airtable', secretEnv: 'TOKEN', permissions: ['read'] }, { env: { TOKEN: 'fictional-test-token' }, transport }); t.after(() => c.close());
  const tools = await c.listTools();
  assert.deepEqual(tools.data.map(t => t.name), ['search_records']);
  assert.equal(tools.data[0].inputSchema.properties.query.type, 'string');
  const result = await c.call('search_records', { query: 'hello' });
  assert.equal(result.trust, 'untrusted');
  assert.equal(JSON.parse(result.data.content[0].text).records[0].query, 'hello');
  await assert.rejects(c.call('create_records_for_table', {}), { code: 'PERMISSION_DENIED' });
  assert.equal(writes, 0);
  await assert.rejects(c.call('search_records', {}), { code: 'UPSTREAM_TOOL_ERROR' });
});
test('Airtable validates authentication, fixed endpoint and permissions before connect', async () => {
  const config = { id: 'crm', connector: 'airtable', secretEnv: 'TOKEN', permissions: ['read'] };
  await assert.rejects(createAirtable(config, { env: {} }), { code: 'AUTH_REQUIRED' });
  await assert.rejects(createAirtable({ ...config, permissions: ['write'] }, { env: {} }), { code: 'PERMISSION_DENIED' });
  await assert.rejects(createAirtable({ ...config, url: 'https://other.example.com' }, { env: {} }), { code: 'INVALID_CONNECTION' });
});
