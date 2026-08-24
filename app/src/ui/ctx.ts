/* The seam between the ported UI and the legacy one.

   Ported panels do not share a scope with builder.html, and that is not a style
   preference — Preact's bundle declares `$` at top level and so does builder.html, so
   merging them is `Identifier '$' has already been declared` and a dead app. The UI
   bundle is therefore an IIFE, and everything it needs from the old world arrives
   through this file instead of by being in scope.

   That constraint turns out to be the feature. `Legacy` below is an explicit list of
   what is not ported yet: when a panel moves across, the names it used come off the
   list, and the list reaching empty is the migration being finished. An ambient
   `declare function` file would have compiled just as well and told nobody anything.

   `Core` is derived from the module rather than hand-written, so it cannot drift. */
import type * as CoreNs from '../core/index';

/**
 * The whole core module.
 *
 * This started as a `Pick` of the handful of names the first ported panel used, which
 * was honest while the list was short. By the inspector it was heading past sixty, and
 * a hand-written list of core exports is the EXPORTS mistake again — a second list to
 * drift from the first.
 *
 * So `build.mjs` reshapes the core bundle's own trailing `export { … }` into
 * `var __CORE = { … }` and builder.html hands that over. The list is generated from
 * the real exports, this type is the real module, and neither can fall out of step.
 */
export type Core = typeof CoreNs;

/** What builder.html still owns. Each entry is a thing left to port. */
export interface Legacy {
  /** May this session change the shape of the site, or only its words? False for a
      `content` account on the server; always true in the single-file build, which has no
      accounts. The server refuses a structural save either way — this is so the panels do
      not offer one. */
  canStructure(): boolean;
  /** select an element on the canvas; `null` clears the selection */
  select(id: string | null, opts?: { scroll?: boolean; add?: boolean; range?: boolean }): void;
  /** switch the editing scope between the page and the global header/footer */
  setMode(mode: string): void;
  /** run a menu action against a set of ids — the one entry point for the verbs */
  runAct(act: string, ids: string[]): void;
  /** open the right-click menu at viewport coordinates */
  openCtx(x: number, y: number, ids: string[]): void;
  /** begin a drag-to-reorder from a row's grip */
  startLayerDrag(e: PointerEvent, id: string): void;
  /** the page and the two global regions, in the order they are listed */
  regions: readonly { kind: string; label: string }[];
  /** which region is being edited, as a region `kind` */
  scopeOf(): string;
  /** the `ui.mode` value that edits a given region kind */
  modeFor(kind: string): string;

  /* The dialogs. Each resolves when the person answers and rejects nothing — a
     cancel is a falsy resolution, which is why every caller reads the result rather
     than catching. */
  askText(title: string, label: string, value?: string,
    opts?: { ok?: string; note?: string; placeholder?: string }): Promise<string | null>;
  askConfirm(title: string, msgHtml: string,
    opts?: { ok?: string; danger?: boolean }): Promise<boolean>;
  /** the full-screen content editor for one collection */
  cmsModal(collectionId: string): void;
  /** the save-as-block flow, which asks for a name and whether it is global */
  saveBlockFlow(nodeId: string): void;
  /** a short confirmation in the corner */
  toast(msg: string): void;

  /** begin dragging something onto the canvas */
  startDrag(e: PointerEvent, payload: {
    kind: 'new' | 'pattern' | 'block';
    type?: string; patId?: string; blockId?: string;
    label: string; icon: string;
  }, fromFrame: boolean): void;
  /**
   * Did the drag that just ended actually move? Reads the flag and clears it, because
   * every caller does exactly that: a click fires after a drag, and without this the
   * dragged element would also be appended where it started.
   */
  consumeDragMoved(): boolean;
  /** append a widget at the smart target, select it, and scroll it into view */
  appendSmart(key: string): void;

  /** the new-page dialog */
  newPageModal(): void;
  /** the breadcrumb above the canvas, which carries the page name */
  renderModebar(): void;
  /** write the project to storage now */
  save(): void;
  /** repaint everything — the app's own render cycle */
  appRender(): void;

  /** write the project to storage immediately, skipping the debounce */
  writeNow(): void;
  /** dismiss whichever dialog is open */
  closeModal(): void;

  /* History. `tx` opens a coalescing transaction keyed by field, so a run of
     keystrokes is one undo step; `endTx` closes it on blur. Anything that moves
     history depth has to go through these or the Undo button lies. */
  tx(key: string): void;
  endTx(): void;

  /* Repaints, in four grades. `paint`/`paintCss` are immediate, the `re-` pair are
     debounced for typing, and the css-only ones skip re-rendering the canvas markup. */
  paint(): void;
  paintCss(): void;
  repaint(): void;
  repaintCss(): void;

  /** the canvas geometry, which changes when the inspector shows or hides */
  layoutCanvas(): void;
  positionHud(): void;
  renderDim(): void;

  askPick(title: string, opts: string[][], current?: string): Promise<string | null>;
  /** the bind-every-field-inside dialog */
  bindModal(nodeId: string): void;
  /** put the canvas into rich-text editing on this node */
  enterEdit(nodeId: string): void;

  /* The media library, still legacy: IndexedDB behind an in-memory map. */
  /** one asset's metadata, or null */
  asset(id: string): { url: string; name: string; size: number; w?: number; h?: number } | null;
  /** how many assets the project holds — the Library button only appears above zero */
  assetCount(): number;
  /** take a File into the library, returning its id */
  mediaTake(file: File): Promise<string | null>;
  /** the library picker */
  mediaPicker(): Promise<string | null>;
  /** resolve `asset:id` to something an <img> can load */
  assetsToBlob(v: string): string;
  /** read an image's intrinsic size */
  imgSize(src: string): Promise<{ w: number; h: number } | null>;
}

/* Assigned once by mount(). Live bindings, so the components below see them. */
export let C: Core = null as unknown as Core;
export let L: Legacy = null as unknown as Legacy;

export function install(core: Core, legacy: Legacy) {
  C = core;
  L = legacy;
}

/* Panels repaint themselves by name rather than importing the mount module, which
   would make a cycle of it. Registered by mount(), called from inside components. */
const painters: Record<string, () => void> = {};
export const registerPainter = (name: string, fn: () => void) => { painters[name] = fn; };
export const repaint = (name: string) => { const fn = painters[name]; if (fn) fn(); };
