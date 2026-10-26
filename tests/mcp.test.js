import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../packages/mcp/server.js';
import { fixture } from '../packages/testing/http.js';

async function mailbox(t) {
  const f = await fixture((url, req, res) => res.end(JSON.stringify(url.pathname === '/api/state' ? { accounts: [{ id: 'a' }] } : { messages: [{ id: 'm1', account_id: 'a', subject: 'Hello' }] })));
  t.after(() => f.close());
  return { connections: [{ id: 'mail', connector: 'milo', url: f.url, accountId: 'a', permissions: ['read'] }] };
}
test('MCP handshake, discovery, execution and input validation', async t => {
  const config = await mailbox(t);
  const app = await createServer(config); t.after(() => app.close());
  const [a, b] = InMemoryTransport.createLinkedPair();
  await app.server.connect(a);
  const client = new Client({ name: 'test', version: '1' }); t.after(() => client.close());
  await client.connect(b);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(t => t.name), ['mail_search', 'mail_read']);
  assert.ok(tools.every(t => t.annotations.readOnlyHint));
  const result = await client.callTool({ name: 'mail_search', arguments: {} });
  assert.equal(JSON.parse(result.content[0].text).data[0].id, 'm1');
  const invalid = await client.callTool({ name: 'mail_read', arguments: { messageId: '' } });
  assert.equal(invalid.isError, true);
});
test('stdio CLI works with a real subprocess and private config', async t => {
  const config = await mailbox(t);
  const dir = await mkdtemp(join(tmpdir(), 'cora-connectors-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'connections.json'); await writeFile(path, JSON.stringify(config), { mode: 0o600 });
  const transport = new StdioClientTransport({ command: process.execPath, args: ['packages/mcp/stdio.js'], env: { CORA_CONNECTIONS_FILE: path }, stderr: 'pipe' });
  const client = new Client({ name: 'stdio-test', version: '1' }); t.after(() => client.close());
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 2);
  assert.equal((await client.callTool({ name: 'mail_search', arguments: {} })).isError, undefined);
});
test('duplicate connection names are rejected', async t => {
  const config = await mailbox(t);
  await assert.rejects(createServer({ connections: [...config.connections, ...config.connections] }), { code: 'DUPLICATE_CONNECTION' });
});
test('connections without read permission expose no tools', async t => {
  const config = await mailbox(t); config.connections[0].permissions = ['send'];
  const app = await createServer(config); t.after(() => app.close());
  const [a,b] = InMemoryTransport.createLinkedPair(); await app.server.connect(a);
  const client = new Client({ name: 'denied', version: '1' }); t.after(() => client.close()); await client.connect(b);
  assert.equal(client.getServerCapabilities().tools, undefined);
});
