import { readFile } from 'node:fs/promises';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

try {
  const file = process.env.CORA_CONNECTIONS_FILE;
  if (!file) throw new Error('Missing config');
  const app = await createServer(JSON.parse(await readFile(file, 'utf8')));
  await app.server.connect(new StdioServerTransport());
  const stop = async () => { await app.close(); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} catch {
  process.stderr.write('Cora connectors startup failed. Check private configuration and authentication.\n');
  process.exitCode = 1;
}
