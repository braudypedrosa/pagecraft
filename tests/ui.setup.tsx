/* Shared rig for the component tests.

   The seam is what makes these cheap. A panel reaches the old world only through the
   `Legacy` object, so handing it a recording stub turns "did this button do the right
   thing?" into an assertion about a plain array — no DOM spying, no module mocking.

   The core is the real one. These tests are about the components; the core has its own
   371 cases and there is nothing to gain from faking it here. */
import { render } from 'preact';
import * as C from '../app/src/core/index';
import { install, registerPainter, type Legacy } from '../app/src/ui/ctx';

export type Call = [string, ...any[]];
type StubOptions = {
  canStructure?: boolean;
  dynamicContentProvider?: ReturnType<Legacy['dynamicContentProvider']>;
  wordpressContent?: ReturnType<Legacy['wordpressContent']>;
};

/** Every Legacy entry, recording its name and arguments. Fields that must return a
    value return something harmless; the rest return undefined. */
export function stubLegacy(calls: Call[], opts: StubOptions = {}): Legacy {
  const rec = (name: string) => (...args: any[]) => { calls.push([name, ...args]); };
  return {
    /* True by default, because that is the single-file build and most cases are not about
       roles. `stubLegacy(calls, { canStructure: false })` is how a case asks for the other. */
    canStructure: () => opts.canStructure !== false,
    dynamicContentProvider: () => opts.dynamicContentProvider || 'pagecraft',
    wordpressContent: () => opts.wordpressContent || [],
    select: rec('select'),
    /* records *and* switches, because the real one does: `tree()` reads the mode, so a
       panel that asks to change region before inserting can only be checked against
       where the node actually landed if the stub honours the request. */
    setMode: (mode: string) => { calls.push(['setMode', mode]); C.state.ui.mode = mode as any; },
    /* Records, and honours: a test that opens a component then asserts on `C.tree()` is
       asserting the thing the real app does. */
    editComponent: (cid: string | null) => {
      calls.push(['editComponent', String(cid)]);
      if (cid) C.componentOpen(cid); else C.componentClose();
    },
    runAct: rec('runAct'),
    openCtx: rec('openCtx'),
    startLayerDrag: rec('startLayerDrag'),
    /* The real one is mode-dependent — editing a component shows one region — so the stub is a
       function too, answering with the page's three. */
    regions: () => (C.state.ui.mode === 'component'
      ? [{ kind: 'component', label: 'Component' }]
      : [
        { kind: 'header', label: 'Global header' },
        { kind: 'main', label: 'Page content' },
        { kind: 'footer', label: 'Global footer' }
      ]),
    scopeOf: () => 'main',
    modeFor: (kind: string) => kind === 'main' ? 'page' : kind,
    askText: async (...a: any[]) => { calls.push(['askText', ...a]); return 'Stub name'; },
    askConfirm: async (...a: any[]) => { calls.push(['askConfirm', ...a]); return true; },
    askPick: async (...a: any[]) => { calls.push(['askPick', ...a]); return ''; },
    cmsModal: rec('cmsModal'),
    saveBlockFlow: rec('saveBlockFlow'),
    toast: rec('toast'),
    startDrag: rec('startDrag'),
    consumeDragMoved: () => { calls.push(['consumeDragMoved']); return false; },
    appendSmart: rec('appendSmart'),
    newPageModal: rec('newPageModal'),
    renderModebar: rec('renderModebar'),
    save: rec('save'),
    appRender: rec('appRender'),
    writeNow: rec('writeNow'),
    closeModal: rec('closeModal'),
    closeReviewSurface: rec('closeReviewSurface'),
    tx: rec('tx'),
    endTx: rec('endTx'),
    paint: rec('paint'),
    paintCss: rec('paintCss'),
    repaint: rec('repaint'),
    repaintCss: rec('repaintCss'),
    layoutCanvas: rec('layoutCanvas'),
    positionHud: rec('positionHud'),
    renderDim: rec('renderDim'),
    bindModal: rec('bindModal'),
    enterEdit: rec('enterEdit'),
    asset: () => null,
    assetCount: () => 0,
    mediaTake: async () => null,
    mediaPicker: async () => null,
    assetsToBlob: (v: string) => v,
    imgSize: async () => null
  };
}

export interface Rig {
  calls: Call[];
  host: HTMLElement;
  /** names of the Legacy functions called, in order */
  names(): string[];
  /** the arguments of the first call to `name`, or null */
  arg(name: string): any[] | null;
  /** Render into the host. Pass a factory plus a panel name and `repaint(name)` redraws it,
      which is what mount() wires in the app — without it a component that repaints itself
      looks inert. It has to be a factory: Preact bails when handed the same vnode instance
      twice, so a fixed vnode would make the repaint a silent no-op. */
  draw(vnode: any | (() => any), panel?: string): void;
  $(sel: string): HTMLElement | null;
  $$(sel: string): HTMLElement[];
  /** type into a field and fire `input`, the way a person does */
  type(el: Element, value: string): void;
  click(el: Element | null): void;
  /** pick a value in a select and fire `change` */
  pick(el: Element, value: string): void;
}

/** A blank project plus a mounted container. Called from `beforeEach`. */
export function rig(opts: StubOptions = {}): Rig {
  const calls: Call[] = [];
  install(C, stubLegacy(calls, opts));

  C.seed();
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.state.pages[0].tree = [];
  C.state.header = [];
  C.state.footer = [];
  C.hist.u.length = 0;
  C.hist.r.length = 0;

  const host = document.createElement('div');
  document.body.appendChild(host);

  const fire = (el: Element, type: string) =>
    el.dispatchEvent(new window.Event(type, { bubbles: true }));

  return {
    calls,
    host,
    names: () => calls.map(c => c[0]),
    arg: name => { const hit = calls.find(c => c[0] === name); return hit ? hit.slice(1) : null; },
    draw: (vnode, panel) => {
      const make = typeof vnode === 'function' ? vnode : () => vnode;
      if (panel) registerPainter(panel, () => render(make(), host));
      render(make(), host);
    },
    $: sel => host.querySelector(sel),
    $$: sel => [...host.querySelectorAll(sel)] as HTMLElement[],
    type: (el, value) => { (el as HTMLInputElement).value = value; fire(el, 'input'); },
    click: el => { if (el) el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); },
    pick: (el, value) => { (el as HTMLSelectElement).value = value; fire(el, 'change'); }
  };
}
