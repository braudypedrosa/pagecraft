import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedPath = join(root, 'app/src/core/public-form-controls.generated.ts');
const editorPath = join(root, 'packages/editor/dist/editor.html');
const runtimePath = join(root, 'packages/editor/dist/runtime.js');
const current = 'pc-date-positioner';
const stale = 'pc-stale-date-positioner';
const original = readFileSync(generatedPath, 'utf8');
if (!original.includes(current) || original.includes(stale)) {
  throw new Error('the generated public date runtime is missing its build-order probe');
}

try {
  /* Reproduce the failure mode: a tracked generated file is stale when the package command
     starts. The package build must regenerate before anything imports and caches Core. */
  writeFileSync(generatedPath, original.replaceAll(current, stale));
  execFileSync(process.execPath, [join(root, 'packages/editor/build.mjs')], {
    cwd: root,
    stdio: 'inherit',
  });

  const generated = readFileSync(generatedPath, 'utf8');
  const editor = readFileSync(editorPath, 'utf8');
  const runtime = readFileSync(runtimePath, 'utf8');
  for (const [label, source] of [['generated runtime', generated], ['editor', editor], ['runtime asset', runtime]]) {
    if (!source.includes(current) || source.includes(stale)) {
      throw new Error(`${label} retained a stale public form runtime`);
    }
  }
  console.log('Direct editor package build refreshed stale public form runtimes before importing Core');
} finally {
  /* A failed or interrupted child should not leave the deliberate stale probe in source. */
  const generated = readFileSync(generatedPath, 'utf8');
  if (generated.includes(stale)) writeFileSync(generatedPath, original);
}
