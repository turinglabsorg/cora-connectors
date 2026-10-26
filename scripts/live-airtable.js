import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createAirtable } from '../connectors/airtable/index.js';

const baseId = process.env.CORA_AIRTABLE_TEST_BASE;
const tableId = process.env.CORA_AIRTABLE_TEST_TABLE;
const fieldId = process.env.CORA_AIRTABLE_TEST_FIELD;
if (process.env.CORA_AIRTABLE_ALLOW_TEST_WRITES !== 'true' || !baseId || !tableId || !fieldId) {
  throw new Error('Set the dedicated test base, table, text field and CORA_AIRTABLE_ALLOW_TEST_WRITES=true. This script creates, updates and deletes its own test record.');
}
const config = { id: 'airtable_test', connector: 'airtable', secretEnv: 'CORA_AIRTABLE_TOKEN', permissions: ['read', 'write'] };
const client = await createAirtable(config);
let recordId;
function data(result) {
  const value = result.data;
  if (value.structuredContent) return value.structuredContent;
  return JSON.parse(value.content.find(item => item.type === 'text').text);
}
try {
  const tools = (await client.listTools()).data.map(tool => tool.name);
  for (const name of ['list_records_for_table', 'create_records_for_table', 'update_records_for_table', 'delete_records_for_table']) assert.ok(tools.includes(name));
  const marker = `Cora connector test ${randomUUID()}`;
  const created = data(await client.call('create_records_for_table', { baseId, tableId, records: [{ fields: { [fieldId]: marker } }] }));
  assert.equal(created.records.length, 1);
  recordId = created.records[0].id;
  const read = async () => data(await client.call('list_records_for_table', { baseId, tableId, recordIds: [recordId], fieldIds: [fieldId] }));
  const value = record => record.cellValuesByFieldId[fieldId];
  assert.equal(value((await read()).records[0]), marker);
  const updated = `${marker} updated`;
  await client.call('update_records_for_table', { baseId, tableId, records: [{ id: recordId, fields: { [fieldId]: updated } }] });
  assert.equal(value((await read()).records[0]), updated);
  console.log('PASS: record created, read, updated and read back through the production MCP endpoint.');
  const reader = await createAirtable({ ...config, permissions: ['read'] });
  try {
    assert.ok((await reader.listTools()).data.every(tool => !['create_records_for_table', 'update_records_for_table', 'delete_records_for_table'].includes(tool.name)));
    await assert.rejects(reader.call('update_records_for_table', { baseId, tableId, records: [{ id: recordId, fields: { [fieldId]: 'must not be written' } }] }), { code: 'PERMISSION_DENIED' });
    assert.equal(value((await read()).records[0]), updated);
    console.log('PASS: read-only connection hides and blocks record mutations.');
  } finally { await reader.close(); }
} finally {
  try {
    if (recordId) {
      await client.call('delete_records_for_table', { baseId, tableId, recordIds: [recordId] });
      const remaining = data(await client.call('list_records_for_table', { baseId, tableId, recordIds: [recordId] }));
      assert.equal(remaining.records.length, 0);
      console.log('PASS: test record deleted and absence verified.');
    }
  } finally { await client.close(); }
}
