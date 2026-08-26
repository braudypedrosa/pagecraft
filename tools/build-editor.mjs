import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const wordpress = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(wordpress, '..');
const source = join(root, 'index.html');
const output = resolve(process.argv[2] || join(wordpress, 'pagecraft-builder', 'assets', 'pagecraft-editor.html'));
let html = readFileSync(source, 'utf8');

if (!html.includes('window.PC_WORDPRESS') || !html.includes('createWordPressHostAdapter')) {
  throw new Error('The built editor does not contain the WordPress host seam. Run node build.mjs first.');
}
if (!html.includes('<script>\n/* =====================================================================')) {
  throw new Error('The editor injection marker is missing.');
}

html = html.replace('<title>Pagecraft Builder</title>', '<title>Pagecraft for WordPress</title>');
writeFileSync(output, html);
console.log(`WordPress editor written to ${output}`);
