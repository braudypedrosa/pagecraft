/* The domain, typed.

   This file is the point of the migration. Three bugs shipped in a single session
   because none of this was expressed anywhere:

   - the `rich` control had no `k`, so `bindableKeys` skipped it and a WYSIWYG body
     could not be bound at all — the most useful binding in the CMS, unreachable.
     `Control` makes `k` required on every kind that writes a prop.
   - `slotHits` returned an offset into one string and `snippet` searched a different
     one. `SlotHit` names which string an offset belongs to.
   - `holds(pt, t)` threw on the null container, because "the root" was expressed as
     `null` in some places and as level 0 in others. `Level` and `ParentType` say it.

   Nothing here changes behaviour. It describes what the code already does. */

/* ---- structure -------------------------------------------------------- */

/** 0 root · 1 section · 2 row · 3 column · 4 leaf. Nesting is decided by this. */
export type Level = 0 | 1 | 2 | 3 | 4;

/** A node type, or `null` for the document root — which holds level-1 nodes. */
export type ParentType = WidgetType | null;

export type WidgetType =
  | 'section' | 'row' | 'list' | 'column'
  | 'heading' | 'text' | 'image' | 'gallery' | 'video' | 'icon'
  | 'button' | 'nav' | 'form' | 'accordion' | 'embed'
  | 'spacer' | 'divider';

/** The three breakpoints, as stored. `d` is the base; `t` and `m` are overrides. */
export type Bp = 'd' | 't' | 'm';
export type Device = 'desktop' | 'tablet' | 'mobile';

/** A CSS declaration block: property to value. An empty string deletes. */
export type Decls = Record<string, string>;

/** Per-breakpoint CSS on a node, a text style or a class. */
export interface Css { d: Decls; t: Decls; m: Decls }

/* ---- nodes ------------------------------------------------------------ */

/** Anything a widget stores that is not styling. Shapes vary by type. */
export type Props = Record<string, unknown>;

/** Advanced, per-node escape hatches. All three reach the export verbatim. */
export interface Adv {
  /** overrides the generated id, used verbatim as a link anchor */
  htmlId: string;
  /** extra classes, emitted as written */
  cls: string;
  /** custom CSS; `&` is replaced by this node's own selector */
  css: string;
  /** set on every placed copy of a global block, linking it back */
  block?: string;
}

export interface Node {
  id: string;
  type: WidgetType;
  props: Props;
  css: Css;
  /** per-breakpoint visibility; `true` means hidden at that breakpoint */
  hide: Partial<Record<Bp, boolean>>;
  /** ids of applied style classes, in no particular order */
  cls: string[];
  adv: Adv;
  children: Node[];
  /** a content source: this node and its subtree bind against this collection */
  src?: string;
  /** prop key to field id. A bound prop takes its value from the item being shown. */
  bind?: Record<string, string>;
}

/** Where a node sits: the node, its parent, the array holding it, and its index. */
export interface Handle {
  node: Node;
  parent: Node | null;
  list: Node[];
  i: number;
}

/* ---- controls ---------------------------------------------------------- */

/** Every control kind the inspector can draw. */
export type ControlKind =
  | 'text' | 'area' | 'select' | 'unit' | 'slider' | 'color' | 'pick' | 'toggle'
  | 'box' | 'img' | 'opt' | 'dims' | 'link' | 'rich' | 'tstyle' | 'source'
  | 'items' | 'fields' | 'qa' | 'imgs' | 'icon' | 'cols';

export interface Control {
  t: ControlKind;
  label: string;
  /** the prop this control writes. Required for anything that stores a value —
      omitting it is what made a WYSIWYG body unbindable. */
  k?: string;
  /** the CSS property this control writes, instead of a prop */
  c?: string;
  /** responsive: writes at the breakpoint being edited rather than the base */
  r?: 0 | 1;
  opts?: [string, string][] | ((n: Node) => [string, string][]);
  og?: () => [string, [string, string][]][];
  units?: string[];
  ph?: string;
  note?: string;
  rows?: number;
  mono?: 0 | 1;
  min?: number;
  max?: number;
  step?: number;
  raw?: 0 | 1;
  neg?: 0 | 1;
  bg?: 0 | 1;
  tk?: string;
  /** a `pick` whose options are words rather than icon names */
  text?: 0 | 1;
}

export interface WidgetDef {
  label: string;
  icon: string;
  level: Level;
  /** which levels this type may contain */
  accepts?: Level[];
  /** how its content is edited in place, if at all */
  edit?: 'text' | 'rich';
  make: () => { props: Props; css: Partial<Css> };
  controls: { content: Control[]; style: Control[] };
}

/* ---- design system ---------------------------------------------------- */

export interface ColorToken { id: string; name: string; value: string }
export interface TextStyle { id: string; name: string; tag?: string; css: Css }
export interface StyleClass { id: string; name: string; css: Css }

export interface Tokens {
  colors: ColorToken[];
  /** the text styles. Stored as `text`, read through `styles()` — the accessor and
      the key have never agreed, and only the type made that visible. */
  text: TextStyle[];
  classes: StyleClass[];
}

/* ---- content ---------------------------------------------------------- */

export type FieldType =
  | 'text' | 'rich' | 'image' | 'link' | 'number' | 'date' | 'option' | 'bool';

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  required?: 0 | 1;
  opts?: string;
}

export interface Item {
  id: string;
  slug: string;
  /** field id to value. Always a string as stored, whatever the field type. */
  values: Record<string, string>;
  /** a hand-set slug stops following the title */
  slugLocked?: 1;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  fields: Field[];
  items: Item[];
  /** unused; detail pages are found by `page.collection` instead */
  detail: string;
}

/* ---- pages and the project ------------------------------------------- */

export interface Page {
  id: string;
  name: string;
  /** the published URL stem. Never rewritten by find-and-replace. */
  slug: string;
  title: string;
  desc: string;
  ogImage?: string;
  tree: Node[];
  /** makes this page a detail template: one file per item of that collection */
  collection?: string;
  bindTitle?: string;
  bindDesc?: string;
}

export interface SavedBlock {
  id: string;
  name: string;
  node: Node;
  /** a global block tags its copies so one can push to the others */
  sync: boolean | 0 | 1;
}

export interface Meta {
  name: string;
  maxWidth: string;
  font: string;
  headFont: string;
  size: string;
  css: string;
  headHtml: string;
  lang: string;
  baseUrl: string;
  ogImage: string;
  favicon: string;
  blocks: SavedBlock[];
  /** added by migration v6→v7, so absent on a freshly-declared literal */
  collections?: Collection[];
  tokens: Tokens | null;
}

/** Editor state. Never persisted — `doc()` deliberately omits it. */
export interface Ui {
  mode: 'page' | 'header' | 'footer';
  dev: Device;
  /** the primary selection, whose controls the inspector draws */
  sel: string | null;
  /** the rest of the selection set */
  multi: string[];
  tab: string;
  atab: string;
  stab: string;
  target: string;
  lmode: { key: string; mode: string } | null;
  open: Record<string, boolean>;
  collapsed: Record<string, boolean>;
  custom: Record<string, boolean>;
  zoom: string;
  item?: Record<string, number>;
}

export interface State {
  v: number;
  meta: Meta;
  header: Node[];
  footer: Node[];
  pages: Page[];
  cur: number;
  ui: Ui;
}

/** What `doc()` returns and what storage round-trips. No `ui`. */
export interface Doc {
  meta: Meta;
  header: Node[];
  footer: Node[];
  pages: Page[];
}

/* ---- rendering and export --------------------------------------------- */

/** Options threaded through `renderNode`. */
export interface RenderOpts {
  /** editor chrome on, ids as node ids, no lazy loading */
  edit: boolean;
  /** the collection in scope, if any */
  col?: Collection | null;
  /** the item being rendered, on a detail page or inside a repeater */
  item?: Item | null;
  /** how far this file sits from the root, e.g. '../' */
  rel?: string;
  /** set while a Collection list repeats its contents */
  repeat?: boolean;
  repIndex?: number;
}

/** One file the export will write. */
export interface Target {
  pg: Page;
  path: string;
  rel: string;
  col: Collection | null;
  item: Item | null;
}

/* ---- review ----------------------------------------------------------- */

export type Level_ = 'error' | 'warn';

export interface Finding {
  level: Level_;
  code: string;
  msg: string;
  where: { page?: string; slug?: string; region?: string; node?: string };
  nodeId?: string;
}

/* ---- find and replace ------------------------------------------------- */

/** Which string a slot's text lives in, and where inside it. */
export interface Slot {
  prop: string;
  /** index into an array prop, or -1 for a plain one */
  i: number;
  /** key inside an array row, or '' for a plain prop */
  sub: string;
}

/**
 * A count and an offset — and, critically, the string that offset belongs to.
 * Returning the offset without the text is what let `snippet` search a different
 * string and centre on the wrong occurrence.
 */
export interface SlotHit {
  n: number;
  at: number;
  text: string;
}

/* ---- menus ------------------------------------------------------------ */

export interface MenuItem {
  act: string;
  label: string;
  /** the keyboard shortcut, shown beside the label */
  key?: string;
  /** a hairline follows this item */
  sep?: boolean;
  danger?: boolean;
}
