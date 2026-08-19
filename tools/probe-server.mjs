/* Serves page-builder/ and records what each browser reports to /report. */
import { createServer } from 'node:http';
import { readFile, appendFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const LOG = join(ROOT, 'tools', 'compat-results.jsonl');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/report') {
    await appendFile(LOG, JSON.stringify({ ua: url.searchParams.get('ua'), results: JSON.parse(url.searchParams.get('data') || '[]') }) + '\n');
    res.writeHead(204).end();
    return;
  }
  try {
    const p = join(ROOT, url.pathname === '/' ? 'tools/compat.html' : url.pathname);
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(4899, () => console.log('probe server on http://localhost:4899'));
