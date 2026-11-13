import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { componentGalleryPage } from '../../server/src/component-gallery.ts';

const root = resolve(process.cwd());
const port = 4953;
const types = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
};

async function asset(response, base, relative) {
  const file = resolve(base, normalize(relative));
  if (!file.startsWith(resolve(base) + '/')) throw new Error('invalid asset path');
  const body = await readFile(file);
  response.writeHead(200, {
    'content-type': types[extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  response.end(body);
}

createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://127.0.0.1:${port}`);
  try {
    if (url.pathname === '/__gallery-health') {
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ ok: true, root, port }) + '\n');
      return;
    }
    if (url.pathname === '/internal/components') {
      const editor = await readFile(join(root, 'index.html'), 'utf8');
      const html = componentGalleryPage(
        editor,
        url.searchParams.get('host') || undefined,
        url.searchParams.get('section') || undefined,
      );
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      response.end(request.method === 'HEAD' ? '' : html);
      return;
    }
    const baseline = url.pathname.match(/^\/internal\/components\/baselines\/([^/]+\.png)$/);
    if (baseline) {
      await asset(response, join(root, 'public', 'internal-ui-baselines'), baseline[1]);
      return;
    }
    const brand = url.pathname.match(/^\/brand\/([^/]+(?:\/[^/]+)*)$/);
    if (brand) {
      await asset(response, join(root, 'brand'), brand[1]);
      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
  } catch (error) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.message : 'not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Pagecraft component gallery on http://127.0.0.1:${port}/internal/components`);
});
