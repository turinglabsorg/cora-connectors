import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createMilo } from '../connectors/milo/index.js';
import { readJson, serviceUrl } from '../packages/core/index.js';

try {
  const url = serviceUrl(process.env.MILO_URL);
  const state = await readJson(new URL('/api/state', url));
  assert.ok(Array.isArray(state.accounts) && state.accounts.length >= 2);
  const config = accountId => ({ id: 'live', connector: 'milo', url: url.origin, accountId, permissions: ['read'] });
  const samples = [];
  for (const account of state.accounts.slice(0, 2)) {
    const connector = createMilo(config(account.id));
    const result = await connector.search({ view: 'all' });
    assert.ok(result.data.length > 0, 'Live check requires nonempty accounts');
    assert.ok(result.data.every(m => m.account_id === account.id));
    const message = await connector.read({ messageId: result.data[0].id });
    assert.equal(message.data.account_id, account.id);
    assert.equal(typeof message.data.text_body, 'string');
    samples.push(result.data[0]);
  }
  await assert.rejects(createMilo(config(state.accounts[0].id)).read({ messageId: samples[1].id }), { code: 'ACCOUNT_MISMATCH' });
  const absent = `cora-nonexistent-${randomUUID()}`;
  await assert.rejects(createMilo(config(absent)).search(), { code: 'ACCOUNT_NOT_FOUND' });
  const raw = await readJson(new URL(`/api/messages?account=${absent}`, url));
  assert.deepEqual(raw.messages, []);
  console.log('PASS: two nonempty accounts isolated; message reads checked; cross-account read denied; unknown account denied; upstream unknown-account search empty.');
} catch {
  console.error('FAIL: live Milo isolation check. No private response data was logged.');
  process.exitCode = 1;
}
