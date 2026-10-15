import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import * as Core from '../app/src/core/index.ts';
import type { Doc } from '../app/src/core/types.ts';
import {
  compileDocument, type CompilerDependencies,
} from '../packages/editor/src/compiler.ts';
import { compile as compileInWorker, dispose as disposeCompiler } from '../packages/editor/src/compiler-client.ts';
import { COMPILER_DESCRIPTOR, COMPILER_RESULT_FORMAT } from '../packages/editor/src/contract.ts';

const dependencies = (fetcher: typeof fetch = async () => {
  throw new Error('Unexpected font request');
}): CompilerDependencies => ({ fetch: fetcher, crypto: globalThis.crypto });

function compilerDocument(font?: string): Doc {
  Core.blankProject('Compiler input');
  const page = Core.state.pages[0];
  page.id = 'page-compile';
  Core.state.meta.font = font || "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  Core.state.meta.headFont = '';

  const nav = Core.N('nav', {
    aria: 'Primary', menuLocation: 'primary', nativeMenuId: 'old',
    items: [{ id: 'old-item', label: 'Stale menu item', href: 'https://old.example/' }],
  });
  nav.id = 'nav-compile';
  const legacyHeaderNav = Core.N('nav', {
    aria: 'Legacy header',
    items: [{ id: 'old-header', label: 'Old header item', href: 'https://old.example/header/' }],
  });
  legacyHeaderNav.id = 'legacy-header-nav';
  Core.state.header = [legacyHeaderNav];
  const image = Core.N('image', {
    src: 'asset:hero@1024', alt: 'Durable media', w: '1600', h: '900',
  });
  image.id = 'image-compile';
  const contactReference = Core.buildWordPressContentReference('page', '/contact/');
  const button = Core.N('button', { text: 'Contact', link: contactReference, variant: 'outline' });
  button.id = 'button-compile';
  button.css.d['border-top-width'] = '0';
  page.tree = [Core.N('section', {}, {}, [nav, image, button])];
  return Core.clone(Core.doc());
}

beforeEach(() => {
  Core.blankProject('Open editor document');
  Core.state.pages[0].id = 'active-page';
});

describe('sealed editor compiler', () => {
  it('compiles current WordPress snapshots with exact provenance and restores Core state', async () => {
    const input = compilerDocument();
    Core.blankProject('Still open in the editor');
    Core.state.pages[0].id = 'active-page';
    const activeBefore = JSON.stringify(Core.doc());
    const contactReference = Core.buildWordPressContentReference('page', '/contact/');

    const result = await compileDocument(input, {
      pageId: 'page-compile',
      assets: { hero: { url: 'https://cdn.example.test/uploads/hero.jpg', name: 'Hero' } },
      wordpressContent: { [contactReference]: 'https://site.example.test/contact/?from=menu&view=full' },
      wordpressMenus: [{
          location: 'primary',
          id: '42',
          items: [{
            id: 'home', label: 'Current home', url: 'https://site.example.test/current/',
            classes: ['menu-current'], objectType: 'page', objectId: '8',
          }],
      }],
      design: { maxWidth: '1337px' },
    }, dependencies());

    expect(result.format).toBe(COMPILER_RESULT_FORMAT);
    expect(result.compiler).toEqual(COMPILER_DESCRIPTOR);
    expect(Object.keys(result.compiler)).toEqual([
      'format', 'editorVersion', 'schemaVersion', 'rendererVersion', 'rendererRevision',
    ]);
    expect(result.html).toContain('https://cdn.example.test/uploads/hero.jpg');
    expect(result.html).not.toContain('asset:hero');
    expect(result.html).toContain('Current home');
    expect(result.html).not.toContain('Stale menu item');
    expect(result.html).not.toContain('Old header item');
    expect(result.html).toContain('https://site.example.test/current/');
    expect(result.html).toContain('menu-current');
    expect(result.html).toContain('data-pagecraft-menu-location="primary"');
    expect(result.html).toContain('https://site.example.test/contact/?from=menu&amp;view=full');
    expect(result.html).not.toContain('%%PAGECRAFT_WP_CONTENT');
    expect(result.globalCss).toContain('--maxw:1337px');
    expect(result.pageCss).toContain('.pagecraft-button-compile.pagecraft-button{border-top-width:0;}');
    expect(result.fontCss).toBe('');
    expect(result.contentHash).toBe(createHash('sha256').update(JSON.stringify({
      html: result.html, globalCss: result.globalCss, pageCss: result.pageCss,
    })).digest('hex'));
    expect(JSON.stringify(Core.doc())).toBe(activeBefore);
  });

  it('fails closed for unresolved assets and restores Core after failure', async () => {
    const input = compilerDocument();
    Core.blankProject('Active failure guard');
    const activeBefore = JSON.stringify(Core.doc());

    await expect(compileDocument(input, {
      pageId: 'page-compile', assets: {},
    }, dependencies())).rejects.toMatchObject({ code: 'missing_assets' });
    expect(JSON.stringify(Core.doc())).toBe(activeBefore);
  });

  it('fails closed when a signed WordPress content target has no current URL', async () => {
    const input = compilerDocument();
    Core.blankProject('Active content guard');
    const activeBefore = JSON.stringify(Core.doc());

    await expect(compileDocument(input, {
      pageId: 'page-compile',
      assets: { hero: { url: 'https://cdn.example.test/hero.jpg' } },
      wordpressContent: {},
    }, dependencies())).rejects.toMatchObject({ code: 'missing_wordpress_content' });
    expect(JSON.stringify(Core.doc())).toBe(activeBefore);
  });

  it('serializes direct compiler calls around asynchronous font work', async () => {
    const first = compilerDocument("'Inter',sans-serif");
    const second = compilerDocument();
    Core.blankProject('Active queue guard');
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let firstFetchStarted = false;
    const fontCss = `/* latin */\n@font-face{font-family:'Inter';font-style:normal;font-weight:400;src:url(https://fonts.gstatic.com/inter.woff2) format('woff2')}`;
    const firstJob = compileDocument(first, {
      pageId: 'page-compile',
      assets: { hero: { url: 'https://cdn.example.test/first.jpg' } },
      wordpressContent: { [Core.buildWordPressContentReference('page', '/contact/')]: 'https://site.example.test/contact/' },
    }, dependencies(async () => {
      firstFetchStarted = true;
      await gate;
      return new Response(fontCss, { status: 200 });
    }));
    while (!firstFetchStarted) await Promise.resolve();

    let secondFinished = false;
    const secondJob = compileDocument(second, {
      pageId: 'page-compile',
      assets: { hero: { url: 'https://cdn.example.test/second.jpg' } },
      wordpressContent: { [Core.buildWordPressContentReference('page', '/contact/')]: 'https://site.example.test/contact/' },
    }, dependencies()).then(result => { secondFinished = true; return result; });
    await Promise.resolve();
    expect(secondFinished).toBe(false);
    release();

    const [firstResult, secondResult] = await Promise.all([firstJob, secondJob]);
    expect(firstResult.fontCss).toContain("font-family:'Inter'");
    expect(secondResult.fontCss).toBe('');
    expect(secondResult.html).toContain('second.jpg');
  });

  it('terminates a hung worker and clears its request with a stable timeout error', async () => {
    const originalWorker = globalThis.Worker;
    let created: { terminated: boolean } | null = null;
    class HangingWorker {
      terminated = false;
      constructor() { created = this; }
      addEventListener() {}
      postMessage() {}
      terminate() { this.terminated = true; }
    }
    Object.defineProperty(globalThis, 'Worker', {
      configurable: true, writable: true, value: HangingWorker,
    });
    try {
      await expect(compileInWorker(compilerDocument(), {
        pageId: 'page-compile', assets: {},
      }, { timeoutMs: 5 })).rejects.toMatchObject({ code: 'compiler_timeout' });
      expect(created).toMatchObject({ terminated: true });
    } finally {
      disposeCompiler();
      Object.defineProperty(globalThis, 'Worker', {
        configurable: true, writable: true, value: originalWorker,
      });
    }
  });
});
