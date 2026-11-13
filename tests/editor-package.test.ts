import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGE_PACKAGE_FORMAT_V1, SITE_PACKAGE_FORMAT_V1 } from '../app/src/package/types.ts';
import { SCHEMA } from '../app/src/core/index.ts';
import { PORTABLE_RENDERER_REVISION } from '../app/src/package/renderer-version.ts';
import { COMPILER_RESULT_FORMAT, EDITOR_VERSION } from '../packages/editor/src/contract.ts';

const root = resolve(import.meta.dirname, '..');

describe('@pagecraft/editor package', () => {
  it('bundles the WordPress host seam and a contract matching the canonical schema', () => {
    const html = readFileSync(resolve(root, 'packages/editor/dist/editor.html'), 'utf8');
    const contract = JSON.parse(readFileSync(resolve(root, 'packages/editor/dist/contract.json'), 'utf8'));
    const catalog = JSON.parse(readFileSync(resolve(root, 'packages/editor/dist/templates.json'), 'utf8'));
    const compiler = readFileSync(resolve(root, 'packages/editor/dist/compiler.js'), 'utf8');
    const compilerWorker = readFileSync(resolve(root, 'packages/editor/dist/compiler-worker.js'), 'utf8');

    expect(html).toContain('window.PC_WORDPRESS');
    expect(html).toContain('createWordPressHostAdapter');
    expect(html).toContain('documentPath: WP.documentPath');
    expect(html).toContain('revisionsPath: WP.revisionsPath');
    expect(html).toContain('WP.returnLabel');
    expect(html).toContain('id="brandHome"');
    expect(html).toContain("WP.pagesUrl || WP.exitUrl || ''");
    expect(html).toContain('.templateControls>.f,.templateControls>.f:last-child{margin-bottom:0}');
    expect(html).toMatch(/class:\s*"ctl",\s*"aria-label":\s*"Animation"/);
    expect(html).toContain('const changed = record.select.value !== option.value');
    expect(html).toContain('record.select.nextElementSibling !== record.trigger');
    expect(html).toContain('event.composedPath().includes(openRecord.menu)');
    expect(html).toContain('/*PAGECRAFT_COMPILER_DESCRIPTOR_START*/ {"format":"pagecraft.editor-contract.v1"');
    expect(html).toContain(`"editorVersion":"${EDITOR_VERSION}"`);
    expect(html).toContain(`"rendererRevision":"${PORTABLE_RENDERER_REVISION}"`);
    expect(html).toContain('compiled: await compilePageForWP(wordpressSnapshot.compiled)');
    expect(contract).toMatchObject({
      format: 'pagecraft.editor-contract.v1',
      editorVersion: EDITOR_VERSION,
      schemaVersion: SCHEMA,
      rendererVersion: `pagecraft-core-${SCHEMA}`,
      rendererRevision: PORTABLE_RENDERER_REVISION,
      compiler: {
        format: COMPILER_RESULT_FORMAT,
        client: 'compiler.js',
        worker: 'compiler-worker.js'
      },
      packages: {
        site: SITE_PACKAGE_FORMAT_V1,
        page: PAGE_PACKAGE_FORMAT_V1
      }
    });
    expect(catalog).toMatchObject({
      format: 'pagecraft.template-catalog.v1',
      templates: expect.arrayContaining([
        expect.objectContaining({ id: 'blank', category: 'Start' }),
        expect.objectContaining({ id: 'landing', category: 'Marketing' }),
        expect.objectContaining({ id: 'about', category: 'Company' }),
        expect.objectContaining({ id: 'work', category: 'Portfolio' }),
        expect.objectContaining({ id: 'article', category: 'Content' })
      ])
    });
    expect(catalog.templates).toHaveLength(12);
    expect(catalog.templates.every((template: any) => template.preview.includes('<svg'))).toBe(true);
    expect(compiler).toContain('compiler-worker.js');
    expect(compiler).toMatch(/export\{[^}]*compile/);
    expect(compilerWorker).toContain('pagecraft.wordpress-compile.v1');
    expect(compilerWorker).toContain(EDITOR_VERSION);
  });

  it('freezes WordPress source and compiled bytes before delayed font loading', async () => {
    const builder = readFileSync(resolve(root, 'builder.html'), 'utf8');
    const start = builder.indexOf('function snapshotPageForWP() {');
    const end = builder.indexOf('\nasync function writeServer', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const source = builder.slice(start, end).replace(
      'async function compilePageForWP(compiled) {\n  return compiled;\n}',
      `async function compilePageForWP(compiled) {
  compiled.globalCss = (await wordpressFontCss()) + compiled.globalCss;
  return compiled;
}`
    );
    let release!: (value: string) => void;
    const fonts = new Promise<string>(resolveFonts => { release = resolveFonts; });
    const state = {
      document: { meta: { name: 'Before' }, pages: [{ id: 'page-1', text: 'Before' }] }
    };
    const helpers = new Function(
      'clone', 'doc', 'wordpressStyles', 'page', 'assetsToBlob', 'buildPage',
      'BUNDLED_COMPILER_CONTRACT', 'wordpressFontCss',
      `${source}; return { snapshotPageForWP, compilePageForWP };`
    )(
      structuredClone,
      () => state.document,
      (current: { text: string }) => {
        (state.document.meta as { components?: unknown[] }).components ||= [];
        return { global: `global:${current.text}`, page: `page:${current.text}` };
      },
      () => state.document.pages[0],
      (value: string) => value,
      (current: { text: string }) => `<p>${current.text}</p>`,
      { format: 'pagecraft.editor-contract.v1' },
      () => fonts,
    );

    const snapshot = helpers.snapshotPageForWP();
    const compiling = helpers.compilePageForWP(snapshot.compiled);
    state.document.meta.name = 'After';
    state.document.pages[0].text = 'After';
    release('fonts;');

    const compiled = await compiling;
    expect(snapshot.document.meta.name).toBe('Before');
    expect(snapshot.document.meta.components).toEqual([]);
    expect(snapshot.document.pages[0].text).toBe('Before');
    expect(compiled.html).toBe('<p>Before</p>');
    expect(compiled.globalCss).toBe('fonts;global:Before');
    expect(compiled.pageCss).toBe('page:Before');
  });
});
