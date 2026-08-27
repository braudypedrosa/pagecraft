import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [join(here, 'src', 'main.tsx')],
  outfile: join(here, 'main.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  jsx: 'automatic',
  jsxImportSource: 'preact',
  legalComments: 'none',
  sourcemap: true
});

console.log('Built the Pagecraft marketing-site framework bundle.');
