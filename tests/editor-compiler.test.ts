import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import * as Core from '../app/src/core/index.ts';
import type { Doc } from '../app/src/core/types.ts';
import {
  compileDocument, compilerSha256, type CompilerDependencies,
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
  it('matches Node SHA-256 without Web Crypto for empty, Unicode, and large compiler output', async () => {
    const samples = [
      '',
      'Caf\u00e9 \u2615\ufe0f \u4f60\u597d \ud83c\udf0d',
      'Pagecraft local compiler \u2014 '.repeat(100_000),
    ];
    for (const sample of samples) {
      expect(await compilerSha256(sample, undefined)).toBe(createHash('sha256').update(sample).digest('hex'));
    }
  });

  it('uses Web Crypto when available and falls back when its digest is disabled', async () => {
    let fastPathCalls = 0;
    const fastCrypto = {
      subtle: {
        digest: async (_algorithm: string, input: BufferSource) => {
          fastPathCalls++;
          return Uint8Array.from(createHash('sha256').update(new Uint8Array(input as ArrayBuffer)).digest()).buffer;
        },
      },
    } as unknown as Crypto;
    expect(await compilerSha256('fast path', fastCrypto)).toBe(createHash('sha256').update('fast path').digest('hex'));
    expect(fastPathCalls).toBe(1);

    const disabledCrypto = {
      subtle: { digest: async () => { throw new Error('SubtleCrypto unavailable'); } },
    } as unknown as Crypto;
    expect(await compilerSha256('fallback', disabledCrypto)).toBe(createHash('sha256').update('fallback').digest('hex'));
  });

  it('reports an actionable compiler error when neither hashing implementation can run', async () => {
    const original = globalThis.TextEncoder;
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, writable: true, value: undefined });
    try {
      await expect(compilerSha256('cannot hash', undefined)).rejects.toMatchObject({
        name: 'PagecraftCompilerError',
        code: 'hash_failed',
        message: 'Pagecraft could not verify the generated output in this browser. Reload the editor and retry.',
      });
    } finally {
      Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, writable: true, value: original });
    }
  });

  it('completes a document compile when a local worker exposes no SubtleCrypto', async () => {
    const input = compilerDocument();
    const result = await compileDocument(input, {
      pageId: 'page-compile',
      assets: { hero: { url: 'http://pagecraft.local/uploads/hero.jpg' } },
      wordpressContent: {
        [Core.buildWordPressContentReference('page', '/contact/')]: 'http://pagecraft.local/contact/',
      },
    }, { ...dependencies(), crypto: {} as Crypto });

    expect(result.contentHash).toBe(createHash('sha256').update(JSON.stringify({
      html: result.html, globalCss: result.globalCss, pageCss: result.pageCss,
    })).digest('hex'));
  });

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

  it('binds current WordPress menus through reachable component definitions and slots once', async () => {
    Core.blankProject('Component menu compiler input');
    const page = Core.state.pages[0];
    page.id = 'component-menu-page';

    const primaryNav = Core.N('nav', {
      aria: 'Shared primary', collapse: 'tablet', mobileMenu: 'fullscreen',
      items: [{ id: 'old-primary', label: 'Stale primary', href: 'https://old.example/primary' }],
    }, { d: { '--nav-gap': '31px' }, t: { 'font-size': '14px' }, m: { 'font-size': '12px' } });
    primaryNav.id = 'component-primary-nav';
    const primary = { id: 'primary-component', name: 'Primary component', node: primaryNav, props: [] };

    const slotTarget = Core.N('box', { layout: 'flex' });
    slotTarget.id = 'component-slot-target';
    slotTarget.slot = 'menu';
    const slotRoot = Core.N('section', {}, {}, [slotTarget]);
    slotRoot.id = 'component-slot-root';
    const slot = { id: 'slot-component', name: 'Slot component', node: slotRoot, props: [] };
    const slotNav = Core.N('nav', {
      aria: 'Shared utility', collapse: 'mobile', mobileMenu: 'dropdown',
      items: [{ id: 'old-utility', label: 'Stale utility', href: 'https://old.example/utility' }],
    });
    slotNav.id = 'component-slot-nav';
    slotNav.slot = 'menu';

    const footerNav = Core.N('nav', {
      aria: 'Shared footer', collapse: 'never', mobileMenu: 'dropdown',
      items: [{ id: 'old-footer', label: 'Stale footer', href: 'https://old.example/footer' }],
    });
    footerNav.id = 'component-footer-nav';
    const footerRoot = Core.N('section', {}, {}, [Core.N('box', {}, {}, [footerNav])]);
    footerRoot.id = 'component-footer-root';
    const footer = { id: 'footer-component', name: 'Footer component', node: footerRoot, props: [] };

    const cycleA = Core.N('section');
    cycleA.id = 'component-cycle-a-root';
    const cycleB = Core.N('section');
    cycleB.id = 'component-cycle-b-root';
    const cycleBInstance = Core.clone(cycleB);
    cycleBInstance.id = 'component-cycle-b-instance';
    cycleBInstance.use = 'cycle-b';
    const cycleAInstance = Core.clone(cycleA);
    cycleAInstance.id = 'component-cycle-a-instance';
    cycleAInstance.use = 'cycle-a';
    cycleA.children = [cycleBInstance];
    cycleB.children = [cycleAInstance];
    const cycleAComponent = { id: 'cycle-a', name: 'Cycle A', node: cycleA, props: [] };
    const cycleBComponent = { id: 'cycle-b', name: 'Cycle B', node: cycleB, props: [] };

    const orphanNav = Core.N('nav', {
      items: [{ id: 'orphan', label: 'Orphan component item', href: 'https://orphan.example/' }],
    });
    orphanNav.id = 'component-orphan-nav';
    const orphan = { id: 'orphan-component', name: 'Orphan component', node: orphanNav, props: [] };
    /* Put the orphan first so a blanket definition scan would steal Primary from the first
       component that the header actually renders. */
    Core.state.meta.components = [orphan, primary, slot, footer, cycleAComponent, cycleBComponent];

    const instance = (definition: typeof primary, id: string, children = [] as typeof primaryNav.children) => {
      const node = Core.clone(definition.node);
      node.id = id;
      node.use = definition.id;
      node.children = children;
      node.css = { d: {}, t: {}, m: {} };
      return node;
    };
    Core.state.header = [
      instance(primary, 'primary-instance-a'),
      instance(primary, 'primary-instance-b'),
      instance(slot, 'slot-instance', [slotNav]),
      instance(cycleAComponent, 'cycle-instance'),
    ];
    Core.state.footer = [instance(footer, 'footer-instance')];
    const input = Core.clone(Core.doc());
    const inputBefore = JSON.stringify(input);

    const result = await compileDocument(input, {
      pageId: page.id,
      assets: {},
      wordpressMenus: [
        { id: '10', location: 'primary', items: [{ id: 'p1', label: 'Current primary', url: 'https://example.test/' }] },
        { id: '11', location: 'utility', items: [{ id: 'u1', label: 'Current utility', url: 'https://example.test/utility/' }] },
        { id: '12', location: 'footer', items: [{ id: 'f1', label: 'Current footer', url: 'https://example.test/footer/' }] },
      ],
    }, dependencies());

    expect(result.html.match(/data-pagecraft-menu-location="primary"/g)).toHaveLength(2);
    expect(result.html.match(/data-pagecraft-menu-location="utility"/g)).toHaveLength(1);
    expect(result.html.match(/data-pagecraft-menu-location="footer"/g)).toHaveLength(1);
    expect(result.html.match(/Current primary/g)).toHaveLength(2);
    expect(result.html).toContain('Current utility');
    expect(result.html).toContain('Current footer');
    expect(result.html).not.toContain('Stale primary');
    expect(result.html).not.toContain('Stale utility');
    expect(result.html).not.toContain('Stale footer');
    expect(result.html).not.toContain('Orphan component item');
    expect(result.html.match(/data-mobile-menu="fullscreen"/g)).toHaveLength(2);
    expect(result.globalCss).toContain('--nav-gap:31px');
    expect(result.globalCss).toContain('font-size:14px');
    expect(result.globalCss).toContain('font-size:12px');
    expect(result.globalCss).toContain(`.${Core.nodeClass(primaryNav)} .pagecraft-nav-toggle{display:flex}`);
    expect(result.globalCss).not.toContain(`.${Core.nodeClass(footerNav)} .pagecraft-nav-toggle{display:flex}`);
    expect(JSON.stringify(input)).toBe(inputBefore);
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
