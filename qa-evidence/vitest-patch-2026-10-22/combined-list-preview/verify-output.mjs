import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const accepted = '6f915c64ddc94b7560be957c6fa63bfab02bdd48';
const evidence = 'qa-evidence/vitest-patch-2026-10-22/combined-list-preview';
const paths = ['index.html', 'dist/core.cjs', 'packages/editor/dist/contract.json', 'packages/editor/dist/editor.html', 'packages/editor/dist/runtime.js', 'packages/editor/dist/templates.json', 'packages/editor/dist/fixtures/page.pagecraft-page.zip', 'packages/editor/dist/fixtures/site.pagecraft-site.zip'];
const hash = b => createHash('sha256').update(b).digest('hex');
const normalize = text => text.replaceAll('../integer-typing-218f115/node_modules/', 'node_modules/');
const rows = paths.map(path => {
  const committed = execFileSync('git', ['show', `${accepted}:${path}`], { maxBuffer: 30e6 });
  const current = readFileSync(path);
  const exact = committed.equals(current);
  const pathCommentOnly = !exact && normalize(committed.toString()) === current.toString();
  return { path, committedSha256: hash(committed), candidateSha256: hash(current), exact, dependencyPathCommentOnly: pathCommentOnly, accepted: exact || pathCommentOnly };
});
writeFileSync(`${evidence}/accepted-output-comparison.json`, JSON.stringify({ acceptedCommit: accepted, normalization: 'Only ../integer-typing-218f115/node_modules/ becomes node_modules/. No CSS, JavaScript, markup, JSON or ZIP content normalization.', rows }, null, 2) + '\n');
console.log(JSON.stringify(rows.map(({ path, exact, dependencyPathCommentOnly, accepted }) => ({ path, exact, dependencyPathCommentOnly, accepted })), null, 2));
if (rows.some(row => !row.accepted)) process.exitCode = 1;
