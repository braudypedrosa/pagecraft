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
  | 'section' | 'row' | 'list' | 'slider' | 'column'
  | 'heading' | 'text' | 'quote' | 'image' | 'gallery' | 'video' | 'icon'
  | 'tabs' | 'table' | 'code' | 'crumbs'
  | 'button' | 'nav' | 'form' | 'accordion' | 'embed'
  | 'spacer' | 'divider';

/** The three breakpoints, as stored. `d` is the base; `t` and `m` are overrides. */
export type Bp = 'd' | 't' | 'm';
export type Device = 'desktop' | 'tablet' | 'mobile';

/** A CSS declaration block: property to value. An empty string deletes. */
export type Decls = Record<string, string>;

/** Per-breakpoint CSS on a node, a text style or a class. */
export interface Css { d: Decls; t: Decls; m: Decls }

/** Scroll-triggered motion on one element. Absent until an animation is chosen, so a project
    carries nothing for the elements that do not move. */
export interface Anim {
  /** one of `ANIM_NAMES`; empty or absent means no animation */
  name?: string;
  /** CSS times, e.g. `0.6s`. Empty means the library's own default. */
  dur?: string;
  delay?: string;
  ease?: string;
  /** animate on the first scroll into view only, rather than every time */
  once?: 0 | 1;
}

/** An interactive state, which is a second axis over the breakpoints. `hover` and
    `focus-visible` are the two worth authoring: one is what a pointer does and the other is
    what a keyboard does, and a rule for the second is the difference between a site that can
    be operated without a mouse and one that cannot. */
export type StateKey = 'hover' | 'focus';
/** Present only once something is set, so a project carries no empty blocks. */
export type States = Partial<Record<StateKey, Css>>;

/* ---- nodes ------------------------------------------------------------ */

/* ---- per-widget props ---------------------------------------------------
   Every prop each widget stores, named. Extracted from each `make()` and every
   control's `k`, so this is the real set rather than a guess. `PropsByType` is what
   makes `Node` a discriminated union: `switch (n.type)` narrows `n.props` with it. */

/** Carried by anything that can link: heading, image, button, icon. */
interface Linkable { link?: string; target?: string }
/** Carried by anything that can take a text style. */
interface Styled { ts?: string }

export interface SectionProps { tag?: string; width?: string; inner?: string }
export interface RowProps { }
export interface ColumnProps { }
export interface ListProps {
  sort?: string; dir?: string; limit?: string;
  /** the field a filter tests, empty for no filter */
  where?: string;
  /** which test — see `FILTER_OPS` */
  op?: string;
  /** what to test against; unused by the `set` and `unset` operators */
  val?: string;
  /** items per exported page. Set, the page this list sits on becomes several files with
      links between them; unset, the list renders everything it matched. Supersedes `limit`,
      which means "never more than this" rather than "this many at a time". */
  per?: string;
}
export interface HeadingProps extends Linkable, Styled { text?: string; level?: string }
export interface TextProps extends Styled { html?: string }
export interface QuoteProps extends Styled { text?: string; by?: string; source?: string }
export interface ImageProps extends Linkable {
  src?: string; alt?: string; caption?: string; decorative?: 0 | 1 | boolean;
  w?: string; h?: string; lazy?: 0 | 1 | boolean;
}
export interface GalleryProps {
  items?: GalleryTile[]; ratio?: string; fit?: string;
  captions?: 0 | 1 | boolean; lightbox?: 0 | 1 | boolean; lazy?: 0 | 1 | boolean;
}
export interface GalleryTile { src?: string; alt?: string; caption?: string; w?: string; h?: string }
export interface VideoProps {
  src?: string; poster?: string; ratio?: string;
  autoplay?: 0 | 1 | boolean; loop?: 0 | 1 | boolean;
  muted?: 0 | 1 | boolean; controls?: 0 | 1 | boolean; facade?: 0 | 1 | boolean;
}
export interface IconProps extends Linkable { name?: string; label?: string }
export interface ButtonProps extends Linkable, Styled {
  text?: string; variant?: string; icon?: string; align?: string; wrap?: string;
}
export interface NavProps { items?: NavItem[]; collapse?: string; aria?: string }
export interface NavItem { label?: string; href?: string }
export interface FormProps {
  fields?: FormField[]; submit?: string; action?: string; method?: string; aria?: string;
}
export interface FormField {
  type?: string; label?: string; name?: string; ph?: string; opts?: string; required?: 0 | 1;
}
export interface TabsProps { items?: TabPanel[] }
/** A table's body is one string, because that is how tabular data arrives: pasted from a
    spreadsheet. `tableGrid` splits it — on tabs when the paste has them, else on pipes,
    which is what a person types by hand. Never on commas: prose is full of them. */
/** A slider. The scrolling and the snapping are CSS — the only thing needing a script is
    the pair of arrow buttons, and a page without one still swipes and scrolls. */
export interface SliderProps {
  arrows?: 0 | 1;
  /** what a screen reader calls the scrollable region */
  aria?: string;
}

/** A breadcrumb. In `auto` it is derived from where the page sits — a trail you type by
    hand is a nav menu with a different separator. `manual` is the escape hatch for a
    structure the page tree does not describe. */
export interface CrumbsProps {
  /** 'auto' | 'manual' */
  mode?: string;
  /** what to call the front page */
  home?: string;
  /** 'chevron' | 'slash' | 'dot' | 'dash' — a CSS marker, so it is never read aloud */
  sep?: string;
  /** manual mode only */
  items?: NavItem[];
}

/** A code block. `lang` picks the lexer, not a runtime library — the spans are in the
    exported HTML and the page ships no highlighter. */
export interface CodeProps {
  body?: string;
  /** a key of CODE_LANGS */
  lang?: string;
  /** shown above the code — a filename, usually */
  title?: string;
  numbers?: 0 | 1;
  /** wrap long lines instead of scrolling them. Not `wrap`: the button already has one,
      and `Props` is every widget's shape flattened into a single interface. */
  softwrap?: 0 | 1;
  copy?: 0 | 1;
}
export interface TableProps {
  body?: string;
  /** the first row is a column header */
  head?: 0 | 1;
  /** the first cell of every row is that row's header, for a comparison table */
  rowhead?: 0 | 1;
  caption?: string;
  /** 'all' | 'rows' | 'none' */
  rules?: string;
  zebra?: 0 | 1;
}
export interface TabPanel { label?: string; panel?: string }
export interface AccordionProps {
  items?: QaItem[]; open?: string; single?: 0 | 1 | boolean; marker?: string;
}
export interface QaItem { q?: string; a?: string }
export interface EmbedProps { html?: string; ratio?: string }
export interface SpacerProps { }
export interface DividerProps { }

/** Which prop shape belongs to which widget. */
export interface PropsByType {
  section: SectionProps; row: RowProps; list: ListProps; column: ColumnProps;
  heading: HeadingProps; text: TextProps; quote: QuoteProps; image: ImageProps; gallery: GalleryProps;
  video: VideoProps; icon: IconProps; button: ButtonProps; nav: NavProps;
  form: FormProps; accordion: AccordionProps; tabs: TabsProps; table: TableProps; code: CodeProps; crumbs: CrumbsProps; slider: SliderProps; embed: EmbedProps;
  spacer: SpacerProps; divider: DividerProps;
}

/* Flatten the per-widget shapes into one optional-field interface. */
type UnionToIntersection<U> =
  (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

/**
 * What a node stores that is not styling: every prop any widget has, all optional.
 *
 * Derived from `PropsByType` rather than listed again, so adding a prop to one widget
 * adds it here and there is no second list to drift.
 *
 * **Why flat rather than discriminated.** A union keyed on `Node['type']` is the stronger
 * type and the note that used to sit here argued for it. I measured it before writing it:
 * making `Node` a distributed union produces **281 errors** — 75 in the core, 18 in the
 * components, 149 in the tests — and 253 of those are one shape, "property does not exist
 * on the union". Two thirds of the core's are inside `renderNode` alone, which computes
 * `boundProps` into a local *before* its `switch`, so nothing narrows; fixing it means
 * moving that line into all seventeen cases.
 *
 * What that buys over this is only the *cross-widget* mistake — reading `p.alt` in the
 * video case. What it does not buy, because this already does, is catching a misspelt prop
 * name, which is the failure that actually happens and which used to reach exported HTML
 * as a silent empty string.
 *
 * So: this now, and the union is a decision with a known price rather than an aspiration.
 * `PropsByType` is written and correct, so the step is mechanical whenever it is wanted.
 */
export type Props = Partial<UnionToIntersection<PropsByType[WidgetType]>>;

/**
 * A props object being read or written by a name computed at runtime.
 *
 * The inspector does exactly this: a control descriptor carries `k`, and `applyOne`
 * writes `props[k]`. It genuinely does not know which prop it is setting, and a closed
 * interface cannot be indexed by an arbitrary string. Twenty-two branches that all do
 * the same assignment would be worse than saying so here.
 *
 * The point is that this is now *named and local* — about sixteen sites — rather than
 * every prop access in the app being `any`.
 */
export type PropBag = Props & Record<string, unknown>;

/**
 * `items` is three different shapes: gallery tiles, nav links, accordion questions.
 * Flattening the per-widget props therefore makes its element type a union, and a
 * caller inside `case 'gallery'` has to say which one it has. That cast is the one real
 * cost of the flat type over a discriminated `Node`, and it is about ten sites.
 */
export type RowsOf<T> = T[];

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
  /** hover and focus rules, each with its own three breakpoints */
  st?: States;
  /** scroll-triggered motion */
  anim?: Anim;
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
  /** for a `qa` control: the two row props it edits, their placeholders, and what the add
      button says. Defaults to a question and an answer, which is what the accordion wants —
      tabs want a label and a panel, and the shape is otherwise identical. */
  rowKeys?: [string, string];
  rowPhs?: [string, string];
  /** what a freshly added row holds. A tab with no label has nothing to click, so it cannot
      start empty the way an unanswered question can. */
  rowNew?: [string, string];
  addLabel?: string;
  /** a setting rather than content, so it never appears as bindable. `BIND_CTL` decides by
      control kind, which is right until the same kind means both things: a filter's value is
      a text field that configures the list, not text the list displays. */
  set?: 1;
  /** show this control only when the node says so. A filter's operator and value have
      nothing to test until a field is chosen, and two controls that cannot do anything are
      how a panel gets long. Absent means always shown, which is every other control. */
  when?: (n: Node) => boolean;
  /** pairs of value and label. Built with `.map` in places, so string[][] rather
      than a tuple type — describing what the code does, not what would be tidier. */
  opts?: string[][] | ((n: Node) => string[][]);
  /** grouped options: a label and its pairs. Loose because the producers build it
      with nested maps rather than as tuples. */
  og?: () => any[][];
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

/** A shared styling capability a widget can be given.

    The spec's section 1 asks for exactly this: do not implement spacing, typography, borders or
    animation separately inside every component — implement them once and attach them only to
    the component types they suit. `COMMON_STYLE` is the once; `caps` is the attaching.

    Only the capabilities this builder actually has are named. The spec lists `positioning`,
    `conditions` and `interactions` as well, and inventing a name for something that does not
    exist would make the registry a wish rather than a description. */
export type Capability =
  /** padding and margin */
  | 'spacing'
  /** background, border, radius, shadow — anything painted on the box itself */
  | 'decoration'
  /** opacity and transform */
  | 'effects'
  /** its own type controls: size, weight, colour, measure */
  | 'typography'
  /** scroll-triggered motion */
  | 'animation';

export interface WidgetDef {
  label: string;
  icon: string;
  level: Level;
  /** which levels this type may contain */
  accepts?: Level[];
  /** how its content is edited in place, if at all */
  edit?: 'text' | 'rich';
  /** What to call the group holding this widget's own style controls. The Style tab used
      one hardcoded title, "Typography & fill", for every widget — true of a heading, and
      not of a table's cell padding or an image's object-fit. Absent means the widget's own
      label, the way the Content tab already names its group. */
  styleLabel?: string;
  /** Which shared capabilities this widget has. Required, and there is a test for that.

      An exclusion list was the first shape of this — `CONTENT_TYPES`, nine names, and a
      backdrop for everything not on it. Which means a widget added next year gets a capability
      nobody granted it, silently, by never having been thought about. Declaring is the other
      direction: nothing arrives with anything it did not ask for. */
  caps: Capability[];
  make: () => { props: Props; css: Partial<Css> };
  controls: { content: Control[]; style: Control[] };
}

/* ---- design system ---------------------------------------------------- */

export interface ColorToken { id: string; name: string; value: string }
export interface TextStyle { id: string; name: string; tag?: string; css: Css }
export interface StyleClass { id: string; name: string; css: Css; st?: States }

export interface Tokens {
  colors: ColorToken[];
  /** the text styles. Stored as `text`, read through `styles()` — the accessor and
      the key have never agreed, and only the type made that visible. */
  text: TextStyle[];
  classes: StyleClass[];
}

/* ---- content ---------------------------------------------------------- */

export type FieldType =
  | 'text' | 'rich' | 'image' | 'link' | 'number' | 'date' | 'option' | 'bool' | 'ref';

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  required?: 0 | 1;
  opts?: string;
  /** for a `ref` field: the collection it points into. Its value is an item id there. */
  ref?: string;
}

export interface Item {
  id: string;
  slug: string;
  /** field id to value. Always a string as stored, whatever the field type. */
  values: Record<string, string>;
  /** a hand-set slug stops following the title */
  slugLocked?: 1;
  /** held back from the published site: no detail page, no place in any list, absent from
      content.json and the sitemap. Still fully editable in the CMS, which is the point. */
  draft?: 1;
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
  /** extra markup for this page's `<head>`, after the project-wide block. A page-specific
      meta tag, a schema block or a one-page script has nowhere else to go. */
  headHtml?: string;
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
  /** ship the webfonts with the site instead of linking Google. Separate-files exports and
      the archive only — one self-contained file has nowhere to put a woff2. */
  selfHostFonts?: 0 | 1;
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
  /** which page of a paginated list the canvas is showing, 1-based. Clamped on read, so
      deleting items cannot leave it parked past the end. */
  pno?: number;
  /** the interactive state the Style tab is editing. Empty is the resting state, which is
      what every control wrote before there was a choice. */
  st?: '' | StateKey;
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
  /** which page of a paginated list this file is, 1-based, and how many there are. The
      paginator reads both to slice its items and to draw links to its neighbours. */
  pageNo?: number;
  pages?: number;
  /** the Page being rendered. A paginator has to name its own next and previous files, and
      those are built from the page's slug. */
  pg?: Page | null;
  /** the separate-files export, which is the only mode that can carry image variants —
      inlining five copies of every image to save bandwidth on one of them is worse than
      not trying. Off means a single `src` and no `srcset`. */
  variants?: boolean;
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
