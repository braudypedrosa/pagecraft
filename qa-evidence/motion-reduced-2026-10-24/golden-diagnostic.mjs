import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
const root = process.cwd(), evidence = resolve(root, 'qa-evidence/motion-reduced-2026-10-24');
const testFile = resolve(root, 'server/tests/releases.test.ts');
const source = readFileSync(testFile, 'utf8');
const end = source.indexOf("test('the shared WordPress golden vector is deterministic");
if (end < 0) throw new Error('Exact golden test entry not found');
const prefix = source.slice(0, end).replace("import { test } from 'vitest';", '');
const result = await build({ stdin: { contents: prefix + '\nmodule.exports=golden();', resolveDir: dirname(testFile), sourcefile: testFile, loader: 'ts' },
  bundle: true, format: 'cjs', platform: 'node', packages: 'external', write: false, logLevel: 'silent' });
const mod = { exports: {} }; new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(resolve(root, 'package.json')), mod, mod.exports);
const actual = mod.exports, expected = JSON.parse(readFileSync(resolve(root, 'server/tests/fixtures/wordpress-artifact-v1.json'), 'utf8'));
writeFileSync(resolve(evidence, 'diagnostic-actual-golden.json'), JSON.stringify(actual, null, 2) + '\n');
const hash = text => createHash('sha256').update(text).digest('hex'), changes = [];
function walk(a, b, path = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], path + '/' + k);
  } else changes.push({ path, beforeType: typeof a, afterType: typeof b,
    ...(typeof a === 'string' ? { beforeBytes: Buffer.byteLength(a), beforeSha256: hash(a) } : { before: a }),
    ...(typeof b === 'string' ? { afterBytes: Buffer.byteLength(b), afterSha256: hash(b) } : { after: b }) });
}
walk(expected, actual); writeFileSync(resolve(evidence, 'golden-diagnostic-delta.json'), JSON.stringify(changes, null, 2) + '\n');
console.log(JSON.stringify(changes, null, 2));
const { transform } = await import('esbuild');
const { execFileSync } = await import('node:child_process');
const parseAnim = async contents => {
  const compiled = await transform(contents, { loader: 'ts', format: 'cjs' });
  const mod = { exports: {} }; new Function('module', 'exports', compiled.code)(mod, mod.exports); return mod.exports;
};
const oldAnim = await parseAnim(execFileSync('git', ['show', 'HEAD:app/src/core/anim.ts'], { encoding: 'utf8' }));
const newAnim = await parseAnim(readFileSync(resolve(root, 'app/src/core/anim.ts'), 'utf8'));
if (oldAnim.ANIM_CSS !== newAnim.ANIM_CSS) throw new Error('Animation CSS unexpectedly changed');
const routeProof = [];
for (let i = 0; i < expected.artifact.routes.length; i++) {
  const before = expected.artifact.routes[i], after = actual.artifact.routes[i];
  const scripts = text => [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1].trim());
  const a = scripts(before.runtime), b = scripts(after.runtime), changed = a.flatMap((text, k) => text === b[k] ? [] : [k]);
  if (before.bodyHtml !== after.bodyHtml || before.headHtml !== after.headHtml || before.css !== after.css) throw new Error('Authored output changed');
  if (i === 0) { if (changed.length) throw new Error('Nonanimated route changed'); }
  else {
    if (changed.length !== 1 || changed[0] !== 7) throw new Error('Unexpected runtime script changes');
    if (a[7] !== oldAnim.ANIM_JS.trim() || b[7] !== newAnim.ANIM_JS.trim()) throw new Error('Runtime change differs from exact ANIM_JS');
    if (before.runtime.replace(oldAnim.ANIM_JS.trim(), newAnim.ANIM_JS.trim()) !== after.runtime) throw new Error('Runtime wrapper changed');
  }
  routeProof.push({ path: before.path, runtimeScriptCount: a.length, changedScriptIndices: changed, htmlHeadAndCssExact: true });
}
const proof = { signedFixtureLeafDeltas: changes.length, routeProof, animationCssExact: true, threeRuntimeChangesAreOnlyExactAnimJsReplacement: true, sourceVersion: 7 };
writeFileSync(resolve(evidence, 'golden-exact-runtime-proof.json'), JSON.stringify(proof, null, 2) + '\n'); console.log(JSON.stringify(proof));
