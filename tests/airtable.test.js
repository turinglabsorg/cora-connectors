import { createServer } from '../packages/mcp/server.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
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
  await assert.rejects(createAirtable({ ...config, permissions: [] }, { env: {} }), { code: 'PERMISSION_DENIED' });
  await assert.rejects(createAirtable({ ...config, url: 'https://other.example.com' }, { env: {} }), { code: 'INVALID_CONNECTION' });
});

for (const permissions of [['read', 'write'], ['write'], ['read']]) {
  test(`Airtable MCP adapter enforces ${permissions.join('+')} permissions with HTTP record lifecycle`, async t => {
    const records = new Map();
    let mutations = 0;
    const f = await fixture(async (url, req, res) => {
      const server = new McpServer({ name: 'fictional-airtable', version: '1' });
      const result = data => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });
      server.registerTool('list_records_for_table', { inputSchema: {} }, async () => result({ records: [...records.values()] }));
      server.registerTool('create_records_for_table', { inputSchema: { value: z.string() } }, async ({ value }) => { mutations++; records.set('record', { id: 'record', value }); return result({ id: 'record' }); });
      server.registerTool('update_records_for_table', { inputSchema: { value: z.string() } }, async ({ value }) => { mutations++; records.set('record', { id: 'record', value }); return result({ id: 'record' }); });
      server.registerTool('delete_records_for_table', { inputSchema: {} }, async () => { mutations++; records.delete('record'); return result({ deleted: true }); });
      server.registerTool('create_automation', { inputSchema: {} }, async () => { mutations++; return result({}); });
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      await server.connect(transport);
      res.on('close', () => { void transport.close(); void server.close(); });
      await transport.handleRequest(req, res);
    });
    t.after(() => f.close());
    const transport = new StreamableHTTPClientTransport(new URL('/mcp', f.url));
    const app = await createServer({ connections: [{ id: 'crm', connector: 'airtable', secretEnv: 'TOKEN', permissions }] }, { env: { TOKEN: 'fictional-token' }, transport });
    t.after(() => app.close());
    const [a, b] = InMemoryTransport.createLinkedPair();
    await app.server.connect(a);
    const client = new Client({ name: 'permission-test', version: '1' });
    t.after(() => client.close());
    await client.connect(b);
    const tools = (await client.listTools()).tools;
    assert.equal(tools.some(tool => tool.name === 'crm_call'), permissions.includes('read'));
    assert.equal(tools.some(tool => tool.name === 'crm_write'), permissions.includes('write'));
    assert.ok(tools.filter(tool => tool.name !== 'crm_write').every(tool => tool.annotations.readOnlyHint === true));
    const discovery = JSON.parse((await client.callTool({ name: 'crm_tools', arguments: {} })).content[0].text).data;
    assert.equal(discovery.some(tool => tool.name === 'list_records_for_table'), permissions.includes('read'));
    assert.equal(discovery.some(tool => tool.name === 'create_records_for_table'), permissions.includes('write'));
    assert.ok(!discovery.some(tool => tool.name === 'create_automation'));
    if (permissions.includes('write')) {
      const write = tools.find(tool => tool.name === 'crm_write');
      assert.equal(write.annotations.readOnlyHint, false);
      assert.equal(write.annotations.destructiveHint, true);
      for (const [tool, args] of [['create_records_for_table', { value: 'created' }], ['update_records_for_table', { value: 'updated' }], ['delete_records_for_table', {}]]) {
        const response = await client.callTool({ name: 'crm_write', arguments: { tool, arguments: args } });
        assert.equal(response.isError, undefined);
        if (tool === 'create_records_for_table') assert.equal(records.get('record').value, 'created');
        if (tool === 'update_records_for_table') assert.equal(records.get('record').value, 'updated');
        if (permissions.includes('read')) {
          const read = await client.callTool({ name: 'crm_call', arguments: { tool: 'list_records_for_table', arguments: {} } });
          assert.deepEqual(JSON.parse(JSON.parse(read.content[0].text).data.content[0].text).records, [...records.values()]);
        }
      }
      assert.equal(records.size, 0);
      assert.equal(mutations, 3);
      assert.equal((await client.callTool({ name: 'crm_write', arguments: { tool: 'create_automation', arguments: {} } })).isError, true);
      assert.equal(mutations, 3);
    } else {
      assert.equal((await client.callTool({ name: 'crm_write', arguments: { tool: 'create_records_for_table', arguments: { value: 'denied' } } })).isError, true);
      assert.equal((await client.callTool({ name: 'crm_call', arguments: { tool: 'create_records_for_table', arguments: {} } })).isError, true);
      assert.equal(mutations, 0);
    }
  });
}
