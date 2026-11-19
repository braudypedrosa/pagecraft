/* Pixel diff of capture pairs in headless Chrome: changed-pixel count and bounding box per pair. */
import { openBrowser, sleep } from './editor-driver.mjs';
import { readFile, writeFile } from 'node:fs/promises';
const pairs = JSON.parse(process.argv[2]);
const b = await openBrowser({ width: 800, height: 600 });
const out = [];
for (const [a, c, png] of pairs) {
  const A = (await readFile(a)).toString('base64'), C = (await readFile(c)).toString('base64');
  const r = await b.eval(async ([A, C, wantPng]) => {
    const load = s => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/jpeg;base64,' + s; });
    const [x, y] = await Promise.all([load(A), load(C)]);
    if (x.width !== y.width || x.height !== y.height) return { size: [x.width, x.height, y.width, y.height] };
    const cv = n => { const c = document.createElement('canvas'); c.width = x.width; c.height = x.height; const g = c.getContext('2d'); g.drawImage(n, 0, 0); return [c, g, g.getImageData(0, 0, c.width, c.height).data]; };
    const [, , pa] = cv(x); const [cc, gc, pc] = cv(y);
    let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, max = 0;
    for (let i = 0; i < pa.length; i += 4) { const d = Math.max(Math.abs(pa[i] - pc[i]), Math.abs(pa[i + 1] - pc[i + 1]), Math.abs(pa[i + 2] - pc[i + 2])); if (d > 40) { n++; const p = i / 4, px = p % x.width, py = (p / x.width) | 0; x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); } max = Math.max(max, d); }
    let crop = null;
    if (wantPng && n) { const w = Math.min(x1 - x0 + 40, x.width), h = Math.min(y1 - y0 + 40, 900); const o = document.createElement('canvas'); o.width = w * 2 + 10; o.height = h; const g = o.getContext('2d'); g.fillStyle = '#f0f'; g.fillRect(0, 0, o.width, h); g.drawImage(x, Math.max(0, x0 - 20), Math.max(0, y0 - 20), w, h, 0, 0, w, h); g.drawImage(y, Math.max(0, x0 - 20), Math.max(0, y0 - 20), w, h, w + 10, 0, w, h); crop = o.toDataURL('image/png'); }
    return { size: [x.width, x.height], changed: n, box: n ? [x0, y0, x1, y1] : null, max, crop };
  }, [A, C, !!png]);
  if (r.crop) { await writeFile(png, Buffer.from(r.crop.split(',')[1], 'base64')); delete r.crop; }
  out.push({ a, ...r }); console.log(JSON.stringify({ a: a.split('/').pop(), ...r }));
}
await b.close();
