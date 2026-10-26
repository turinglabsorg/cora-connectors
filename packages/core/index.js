import { z } from 'zod';

export class ConnectorError extends Error {
  constructor(code) { super(code); this.name = 'ConnectorError'; this.code = code; }
}

export const connectionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
  connector: z.enum(['milo', 'airtable']),
  permissions: z.array(z.enum(['read', 'write', 'send'])).default(['read']),
  accountId: z.string().min(1).optional(),
  url: z.string().url().optional(),
  secretEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/).optional(),
}).strict();

export function requireRead(connection) {
  if (!connection.permissions.includes('read')) throw new ConnectorError('PERMISSION_DENIED');
}

export function external(data) {
  return { trust: 'untrusted', source: 'external-service', data };
}

export function serviceUrl(value) {
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new ConnectorError('INVALID_SERVICE_URL');
  }
  return url;
}

export async function readJson(url, headers = {}) {
  try {
    const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new ConnectorError(response.status === 401 || response.status === 403 ? 'AUTH_REQUIRED' : 'UPSTREAM_HTTP_ERROR');
    const reader = response.body.getReader();
    let size = 0;
    const chunks = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) { await reader.cancel(); throw new ConnectorError('RESPONSE_TOO_LARGE'); }
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof ConnectorError) throw error;
    throw new ConnectorError('UPSTREAM_UNAVAILABLE');
  }
}
