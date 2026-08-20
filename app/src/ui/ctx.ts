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
 * Exactly the core a ported panel uses — derived with `Pick`, so the types are the
 * real ones and cannot drift, while the object builder.html has to hand over stays
 * small enough to write out. The list grows as panels come across; it is not an
 * attempt to describe the whole core.
 */
export type Core = Pick<typeof CoreNs,
  | 'IC' | 'DEF' | 'DEV_LABEL' | 'state' | 'dk' | 'tree' | 'selIds' | 'nameOf'
  | 'edit' | 'collections' | 'findCollection' | 'collectionAdd' | 'collectionDelete'>;

/** What builder.html still owns. Each entry is a thing left to port. */
export interface Legacy {
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
}

/* Assigned once by mount(). Live bindings, so the components below see them. */
export let C: Core = null as unknown as Core;
export let L: Legacy = null as unknown as Legacy;

export function install(core: Core, legacy: Legacy) {
  C = core;
  L = legacy;
}
