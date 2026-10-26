import { z } from 'zod';
import { ConnectorError, connectionSchema, external, readJson, requireRead, serviceUrl } from '../../packages/core/index.js';

const searchSchema = z.object({ search: z.string().max(300).default(''), view: z.enum(['inbox', 'all', 'sent']).default('inbox') }).strict();
const readSchema = z.object({ messageId: z.string().min(1).max(512) }).strict();

export function createMilo(input, { env = process.env } = {}) {
  const connection = connectionSchema.parse(input);
  if (connection.connector !== 'milo' || !connection.url || !connection.accountId) throw new ConnectorError('INVALID_CONNECTION');
  const base = serviceUrl(connection.url);
  const session = connection.secretEnv ? env[connection.secretEnv] : undefined;
  if (connection.secretEnv && !session) throw new ConnectorError('AUTH_REQUIRED');
  if (session && /[\r\n;]/.test(session)) throw new ConnectorError('INVALID_SESSION');
  const headers = session ? { Cookie: `milo_session=${session}` } : {};
  const get = (path) => readJson(new URL(path, base), headers);

  async function validateAccount() {
    requireRead(connection);
    const state = await get('/api/state');
    if (!Array.isArray(state.accounts)) throw new ConnectorError('INVALID_RESPONSE');
    if (!state.accounts.some(a => a.id === connection.accountId)) throw new ConnectorError('ACCOUNT_NOT_FOUND');
  }
  function checkMessage(message) {
    if (!message || typeof message.id !== 'string' || message.account_id !== connection.accountId) throw new ConnectorError('ACCOUNT_MISMATCH');
    return message;
  }
  return {
    id: connection.id,
    async search(args = {}) {
      const { search, view } = searchSchema.parse(args);
      await validateAccount();
      const query = new URLSearchParams({ account: connection.accountId, search, view });
      const result = await get(`/api/messages?${query}`);
      if (!Array.isArray(result.messages)) throw new ConnectorError('INVALID_RESPONSE');
      return external(result.messages.map(message => {
        checkMessage(message);
        return { id: message.id, account_id: message.account_id, subject: message.subject, sender: message.sender, sender_email: message.sender_email, date: message.date };
      }));
    },
    async read(args) {
      const { messageId } = readSchema.parse(args);
      await validateAccount();
      const message = checkMessage(await get(`/api/messages/${encodeURIComponent(messageId)}?load_images=false`));
      return external({ id: message.id, account_id: message.account_id, subject: message.subject, sender: message.sender, date: message.date, text_body: message.body ?? '', html: message.html ?? '', attachments: (message.attachments ?? []).map(a => ({ index: a.index, name: a.name, type: a.type })) });
    },
    async close() {},
  };
}
