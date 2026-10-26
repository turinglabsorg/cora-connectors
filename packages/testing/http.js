import { createServer } from 'node:http';
import { once } from 'node:events';

export async function fixture(handler) {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url });
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Content-Type', 'application/json');
    handler(url, req, res);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { url: `http://127.0.0.1:${server.address().port}`, requests, async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
