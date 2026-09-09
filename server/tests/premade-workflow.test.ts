import { test } from 'vitest';
import a from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { newWorkflow, promotionFindings, VIEWPORTS, EDIT_CHECKS, VISUAL_CHECKS, type Workflow } from '../../premade-sites/lib/workflow.ts';
const sha = 'a'.repeat(64);
const decision = { actor: 'user' as const, outcome: 'approved' as const, quote: 'I approve this exact artifact.', at: '2026-09-07T00:00:00.000Z', evidence: 'test fixture conversation' };
function approved(packageSha256 = sha): Workflow {
  const w = newWorkflow();
  w.directions = ['a', 'b', 'c'].map(id => ({ id, thesis: 'Fixture direction', fingerprint: { header: id, hero: id, textAnchor: id, inventory: id, cta: id, footer: id }, comparison: 'Fixture comparison', sections: [0, 1].map(() => ({ purpose: 'Browse work', archetype: 'HE02', composition: 'Framed stage', typography: 'Headline', imagery: 'Project', action: 'Open project' })) }));
  w.selection = { directionId: 'a', decision };
  w.targets = { cloud: { hostRevision: 'cloud-sha', editorVersion: '1.0' }, wordpress: { hostRevision: 'wp-sha', editorVersion: '1.0' } };
  w.qa = (['cloud', 'wordpress'] as const).map(host => ({ host, packageSha256, ...w.targets![host], at: decision.at, editChecks: [...EDIT_CHECKS], pages: VIEWPORTS.map(viewport => ({ slug: 'index', viewport, checks: [...VISUAL_CHECKS] })), breakpointChecks: 'Checked both sides of 760 and 1024', evidence: [{ path: 'evidence.txt', sha256: sha }] }));
  w.visualReview = { packageSha256, verdict: 'pass', rationale: 'Test fixture only', evidence: [{ path: 'evidence.txt', sha256: sha }] };
  w.approval = { packageSha256, decision };
  return w;
}
test('release gates require both hosts, all viewports and edits, user selection and final approval', () => {
  a.deepEqual(promotionFindings(approved(), sha, ['index']), []);
  const w = approved(); w.qa[0].pages.pop(); w.qa[1].editChecks.pop(); w.selection = null; w.approval = null;
  const findings = promotionFindings(w, sha, ['index']).join('\n');
  for (const expected of ['cloud:index:1440', 'wordpress: editing exercise', 'direction:', 'approval:']) a.match(findings, new RegExp(expected));
});
test('package and host changes invalidate evidence; unresolved findings remain actionable', () => {
  const w = approved();
  a.match(promotionFindings(w, 'b'.repeat(64), ['index']).join('\n'), /current package/);
  const newer = structuredClone(w.qa[0]); newer.at = '2026-09-07T01:00:00.000Z'; newer.editChecks = []; w.qa.push(newer);
  a.match(promotionFindings(w, sha, ['index']).join('\n'), /cloud: editing exercise missing/);
  w.targets!.wordpress.editorVersion = '2.0';
  w.findings.push({ severity: 'error', page: 'index', node: 'hero', viewport: '390', detail: 'Clipped title', correction: 'Allow wrapping', resolved: false });
  const findings = promotionFindings(w, sha, ['index']).join('\n');
  a.match(findings, /wordpress: current package/); a.match(findings, /index:hero:390: Clipped title; fix: Allow wrapping/);
  a.match(promotionFindings({ ...w, approval: { packageSha256: sha, decision: { ...decision, actor: 'agent' } } }, sha, ['index']).join('\n'), /approval.decision.actor/);
});
test('CLI keeps drafts out of catalog, verifies evidence, promotes once and preserves legacy releases', async () => {
  const root = resolve(import.meta.dirname, '../..');
  const temp = await mkdtemp(resolve(tmpdir(), 'pagecraft-workflow-'));
  const run = (...args: string[]) => execFileSync(process.execPath, [resolve(temp, 'tools/premade-sites.ts'), ...args], { cwd: temp, encoding: 'utf8', stdio: 'pipe' });
  try {
    await mkdir(resolve(temp, 'tools')); await mkdir(resolve(temp, 'premade-sites'));
    await copyFile(resolve(root, 'tools/premade-sites.ts'), resolve(temp, 'tools/premade-sites.ts'));
    await writeFile(resolve(temp, 'package.json'), '{"type":"module"}');
    for (const dir of ['app', 'server', 'node_modules']) await symlink(resolve(root, dir), resolve(temp, dir));
    await symlink(resolve(root, 'premade-sites/lib'), resolve(temp, 'premade-sites/lib'));
    const legacy = { id: 'legacy-site', version: '1.0.0', name: 'Unchanged historical entry' };
    const catalog = JSON.stringify({ format: 'pagecraft.site-template-catalog.v1', templates: [legacy] }) + '\n';
    await writeFile(resolve(temp, 'premade-sites/catalog.json'), catalog);
    run('scaffold', 'fixture', '1.0.0');
    const directory = resolve(temp, 'premade-sites/fixture/1.0.0');
    // Freeze generated ids once, as template sources must be reproducible.
    const { buildTemplateStarter } = await import('../../premade-sites/lib/authoring.ts');
    const doc = buildTemplateStarter('Fixture');
    await writeFile(resolve(directory, 'source.ts'), `export function buildTemplateDocument() { return ${JSON.stringify(doc)}; }`);
    run('build', 'fixture', '1.0.0'); run('check', 'fixture', '1.0.0');
    a.equal(await readFile(resolve(temp, 'premade-sites/catalog.json'), 'utf8'), catalog);
    await writeFile(resolve(directory, 'draft/preview/index.html'), '<p>Unreviewed replacement</p>');
    a.throws(() => run('check', 'fixture', '1.0.0'), /preview:.*missing or changed/);
    run('build', 'fixture', '1.0.0');
    a.throws(() => run('promote', 'fixture', '1.0.0'), /promotion blocked/);
    const manifest = JSON.parse(await readFile(resolve(directory, 'draft/manifest.json'), 'utf8'));
    const w = approved(manifest.packageSha256);
    const evidence = 'Actual evidence belongs here; this is a test fixture.';
    const hash = createHash('sha256').update(evidence).digest('hex');
    w.qa.forEach(q => q.evidence[0].sha256 = hash); w.visualReview!.evidence[0].sha256 = hash;
    await writeFile(resolve(directory, 'workflow.json'), JSON.stringify(w));
    a.throws(() => run('promote', 'fixture', '1.0.0'), /missing or changed/);
    await writeFile(resolve(directory, 'evidence.txt'), evidence);
    a.match(run('status', 'fixture', '1.0.0'), /"ready"/);
    await writeFile(resolve(directory, 'release-review.json'), 'Pre-existing file must survive failed promotion');
    a.throws(() => run('promote', 'fixture', '1.0.0'), /EEXIST/);
    a.equal(await readFile(resolve(directory, 'release-review.json'), 'utf8'), 'Pre-existing file must survive failed promotion');
    a.equal(await readFile(resolve(temp, 'premade-sites/catalog.json'), 'utf8'), catalog);
    await rm(resolve(directory, 'release-review.json'));
    run('promote', 'fixture', '1.0.0');
    const released = await readFile(resolve(directory, 'site.pagecraft-site.zip'));
    a.throws(() => run('build', 'fixture', '1.0.0'), /is released/);
    a.throws(() => run('promote', 'fixture', '1.0.0'), /immutable/);
    a.deepEqual(await readFile(resolve(directory, 'site.pagecraft-site.zip')), released);
    // Legacy releases have no workflow: package checking must remain independent of acceptance records.
    await rm(resolve(directory, 'workflow.json')); run('check', 'fixture', '1.0.0');
    const published = JSON.parse(await readFile(resolve(temp, 'premade-sites/catalog.json'), 'utf8'));
    a.equal(published.templates.length, 2);
    a.deepEqual(published.templates[0], legacy);
  } finally { await rm(temp, { recursive: true, force: true }); }
}, 30000);
