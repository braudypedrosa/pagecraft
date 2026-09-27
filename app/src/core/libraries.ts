/* Libraries (Phase 5): publish reusable items from a site as an immutable bundle, import them
   into another site as locally owned copies, and plan explicit, conflict-aware updates.

   Everything here is pure: a document and a bundle in, a new document and a plan out, so the
   editor (one edit(), one Undo) and the server can share it — the pattern of cms-import.ts and
   media-references.ts. See docs/phase5-libraries-design.md for the contract. */
import type {
  ColorToken, ComponentDef, Doc, LibraryItemKind, LibraryLink, Node, SavedBlock, StyleClass, TextStyle,
} from './types.ts';

export type { LibraryItemKind, LibraryLink } from './types.ts';
export interface LibraryItemRef { kind: LibraryItemKind; id: string }

export interface LibraryBundle {
  format: 'pagecraft.library.v1';
  /** the core SCHEMA the items were written against */
  schemaVersion: number;
  /** what the author chose; everything else in the bundle is here as a dependency */
  chosen: LibraryItemRef[];
  components: ComponentDef[];
  blocks: SavedBlock[];
  colors: ColorToken[];
  textStyles: TextStyle[];
  classes: StyleClass[];
  /** asset ids the items reference; the storage layer carries the bytes */
  assets: string[];
  /** `${kind}:${id}` → sha256 of the normalised item, in the library's id space */
  hashes: Record<string, string>;
}

/* Every site has these, wired into the base stylesheet or seeded by default. A library item that
   uses them means "this site's brand colour", so they are matched to the receiving site's own
   and never duplicated or overwritten. */
const FOUNDATION: Partial<Record<LibraryItemKind, ReadonlySet<string>>> = {
  color: new Set(['text', 'bg', 'brand', 'ink', 'muted', 'muted-i', 'slate', 'line', 'surface']),
  textStyle: new Set(['display', 'title', 'subtitle', 'lead', 'body', 'small', 'eyebrow', 'btn']),
};
const isFoundation = (kind: LibraryItemKind, id: string) => !!FOUNDATION[kind]?.has(id);
const key = (kind: LibraryItemKind, id: string) => `${kind}:${id}`;

const COLOR_REF = /var\(--c-([\w-]+)\)/g;
const ASSET_REF = /asset:([A-Za-z0-9][A-Za-z0-9._:-]*)/g;

/* ---- hashing ---------------------------------------------------------- */

/** Canonical JSON: sorted keys, no undefined. Equal content, equal text. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

/* A small synchronous SHA-256, so the core stays synchronous in the browser and on the server. */
const K = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
export function sha256(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(padded.length - 4, bitLength >>> 0);
  const h = Uint32Array.from([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  return Array.from(h, x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

/* ---- walking and rewriting ------------------------------------------------ */

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const eachNode = (node: Node, visit: (n: Node) => void) => { visit(node); (node.children || []).forEach(child => eachNode(child, visit)); };
const eachString = (value: unknown, visit: (s: string) => void) => {
  if (typeof value === 'string') visit(value);
  else if (Array.isArray(value)) value.forEach(item => eachString(item, visit));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => eachString(item, visit));
};
const mapStrings = (value: unknown, map: (s: string) => string): unknown => {
  if (typeof value === 'string') return map(value);
  if (Array.isArray(value)) return value.map(item => mapStrings(item, map));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, map)]));
  }
  return value;
};

/** Where a library item points: other items, and the assets it shows. */
function referencesOf(kind: LibraryItemKind, item: unknown) {
  const refs: LibraryItemRef[] = [];
  const assets = new Set<string>();
  const cms: string[] = [];
  eachString(item, s => {
    for (const m of s.matchAll(COLOR_REF)) refs.push({ kind: 'color', id: m[1] });
    for (const m of s.matchAll(ASSET_REF)) assets.add(m[1]);
  });
  const root = kind === 'component' ? (item as ComponentDef).node : kind === 'block' ? (item as SavedBlock).node : null;
  if (root) eachNode(root, n => {
    if (n.use) refs.push({ kind: 'component', id: n.use });
    (n.cls || []).forEach(id => refs.push({ kind: 'class', id }));
    const ts = (n.props as { ts?: unknown } | undefined)?.ts;
    if (typeof ts === 'string' && ts) refs.push({ kind: 'textStyle', id: ts });
    if (n.src) cms.push(`collection ${n.src}`);
    Object.values(n.bind || {}).forEach(binding => { if (binding.src === 'field') cms.push(`field ${binding.path}`); });
  });
  if (kind === 'component') {
    const own = (item as ComponentDef).id;
    return { refs: refs.filter(r => !(r.kind === 'component' && r.id === own)), assets: [...assets], cms };
  }
  return { refs, assets: [...assets], cms };
}

type Renames = Partial<Record<LibraryItemKind, Map<string, string>>>;
const rename = (renames: Renames, kind: LibraryItemKind, id: string) => renames[kind]?.get(id) ?? id;

/** The item with every reference passed through `renames` and asset ids through `assets`. */
function rewrite<T>(kind: LibraryItemKind, item: T, renames: Renames, assets: Record<string, string> = {}): T {
  const strings = mapStrings(item, s => s
    .replace(COLOR_REF, (_, id: string) => `var(--c-${rename(renames, 'color', id)})`)
    .replace(ASSET_REF, (whole, id: string) => (assets[id] ? `asset:${assets[id]}` : whole))) as T;
  const root = kind === 'component' ? (strings as unknown as ComponentDef).node : kind === 'block' ? (strings as unknown as SavedBlock).node : null;
  if (root) eachNode(root, n => {
    if (n.use) n.use = rename(renames, 'component', n.use);
    if (n.cls) n.cls = n.cls.map(id => rename(renames, 'class', id));
    const props = n.props as { ts?: string } | undefined;
    if (props && typeof props.ts === 'string' && props.ts) props.ts = rename(renames, 'textStyle', props.ts);
  });
  return strings;
}

/** The item as content: its own id and node ids removed, keys sorted. */
function normalised(kind: LibraryItemKind, item: unknown) {
  const copy = clone(item) as Record<string, unknown>;
  delete copy.id;
  const root = (kind === 'component' || kind === 'block') ? copy.node as Node | undefined : undefined;
  if (root) eachNode(root, n => {
    delete (n as Partial<Node>).id;
    if (n.adv && 'htmlId' in n.adv) delete (n.adv as { htmlId?: string }).htmlId;
  });
  return canonical({ kind, item: copy });
}
export const itemHash = (kind: LibraryItemKind, item: unknown) => sha256(normalised(kind, item));

/* ---- reading items out of a document ------------------------------------- */

interface Lists { component: ComponentDef[]; block: SavedBlock[]; color: ColorToken[]; textStyle: TextStyle[]; class: StyleClass[] }
const listsOf = (doc: Doc): Lists => ({
  component: doc.meta.components || [],
  block: doc.meta.blocks || [],
  color: doc.meta.tokens?.colors || [],
  textStyle: doc.meta.tokens?.text || [],
  class: doc.meta.tokens?.classes || [],
});
const bundleLists = (bundle: LibraryBundle): Lists => ({
  component: bundle.components, block: bundle.blocks, color: bundle.colors, textStyle: bundle.textStyles, class: bundle.classes,
});
const find = (lists: Lists, kind: LibraryItemKind, id: string) =>
  (lists[kind] as { id: string }[]).find(item => item.id === id);

export class LibraryError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(problems.join(' '));
    this.problems = problems;
  }
}

/** Collect the chosen items and everything they depend on into an immutable bundle. */
export function extractLibraryBundle(doc: Doc, chosen: LibraryItemRef[], schemaVersion: number): LibraryBundle {
  const lists = listsOf(doc);
  const problems: string[] = [];
  const seen = new Map<string, { kind: LibraryItemKind; item: { id: string } }>();
  const assets = new Set<string>();
  const queue = [...chosen];
  while (queue.length) {
    const ref = queue.shift()!;
    if (seen.has(key(ref.kind, ref.id))) continue;
    const item = find(lists, ref.kind, ref.id);
    if (!item) {
      // A foundation token the site deleted is simply the receiving site's own, if it has one.
      if (!isFoundation(ref.kind, ref.id)) problems.push(`Missing ${ref.kind} "${ref.id}".`);
      continue;
    }
    seen.set(key(ref.kind, ref.id), { kind: ref.kind, item });
    const found = referencesOf(ref.kind, item);
    found.cms.forEach(what => problems.push(`${ref.kind} "${ref.id}" uses CMS ${what}; libraries do not carry CMS yet.`));
    found.assets.forEach(id => assets.add(id));
    queue.push(...found.refs);
  }
  if (problems.length) throw new LibraryError([...new Set(problems)]);
  const of = <T>(kind: LibraryItemKind) => [...seen.values()].filter(v => v.kind === kind).map(v => clone(v.item) as T);
  const bundle: LibraryBundle = {
    format: 'pagecraft.library.v1',
    schemaVersion,
    chosen: chosen.map(({ kind, id }) => ({ kind, id })),
    components: of<ComponentDef>('component'),
    blocks: of<SavedBlock>('block'),
    colors: of<ColorToken>('color'),
    textStyles: of<TextStyle>('textStyle'),
    classes: of<StyleClass>('class'),
    assets: [...assets].sort(),
    hashes: {},
  };
  for (const [k, v] of seen) bundle.hashes[k] = itemHash(v.kind, v.item);
  return bundle;
}

/* ---- import -------------------------------------------------------------- */

export interface LibrarySource { libraryId: string; version: number }
export interface ImportedItem {
  kind: LibraryItemKind;
  sourceId: string;
  localId: string;
  /** added / renamed: a new copy. reused: an identical item was already here. linked: already
      imported from this library. site-foundation: the site's own token is used. */
  how: 'added' | 'renamed' | 'reused' | 'linked' | 'site-foundation';
}
export interface LibraryImportPlan { doc: Doc; items: ImportedItem[]; assets: string[] }
export interface LibraryImportOptions {
  /** library asset id → the site asset id the storage layer copied it to */
  assets?: Record<string, string>;
  /** fresh node ids; the editor passes its own uid so ids match everything else it makes */
  newId?: () => string;
}

let fallbackSeq = 0;
const fallbackId = () => `l${Date.now().toString(36).slice(-5)}${(fallbackSeq++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
const KINDS_IN_ORDER: LibraryItemKind[] = ['color', 'textStyle', 'class', 'component', 'block'];

/** The dependency closure of `chosen` inside a bundle. */
function closure(bundle: LibraryBundle, chosen: LibraryItemRef[]) {
  const lists = bundleLists(bundle);
  const out = new Map<string, LibraryItemRef>();
  const queue = [...chosen];
  while (queue.length) {
    const ref = queue.shift()!;
    if (out.has(key(ref.kind, ref.id))) continue;
    const item = find(lists, ref.kind, ref.id);
    if (!item) continue; // an absent foundation token: the receiving site's own is used
    out.set(key(ref.kind, ref.id), ref);
    queue.push(...referencesOf(ref.kind, item).refs);
  }
  return [...out.values()];
}

const freeId = (taken: Set<string>, base: string) => {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
};

function place(doc: Doc, kind: LibraryItemKind, item: { id: string }) {
  const meta = doc.meta;
  if (kind === 'component') (meta.components ||= []).push(item as ComponentDef);
  else if (kind === 'block') meta.blocks.push(item as SavedBlock);
  else {
    meta.tokens ||= { colors: [], text: [], classes: [] };
    const list = kind === 'color' ? meta.tokens.colors : kind === 'textStyle' ? meta.tokens.text : meta.tokens.classes;
    (list as { id: string }[]).push(item);
  }
}
function replaceItem(doc: Doc, kind: LibraryItemKind, id: string, item: { id: string }) {
  const lists = listsOf(doc);
  const list = lists[kind] as { id: string }[];
  const at = list.findIndex(existing => existing.id === id);
  if (at >= 0) list[at] = item;
}

const reidTree = (node: Node, newId: () => string) => eachNode(node, n => {
  n.id = newId();
  if (n.adv && n.adv.htmlId) n.adv.htmlId = '';
});

/** Import `chosen` (and their dependencies) from a library version as locally owned copies. */
export function planLibraryImport(
  doc: Doc, bundle: LibraryBundle, source: LibrarySource, chosen: LibraryItemRef[], options: LibraryImportOptions = {},
): LibraryImportPlan {
  if (bundle.format !== 'pagecraft.library.v1') throw new LibraryError(['Unknown library format.']);
  const lists = bundleLists(bundle);
  const absent = chosen.filter(ref => !find(lists, ref.kind, ref.id));
  if (absent.length) throw new LibraryError(absent.map(ref => `This version has no ${ref.kind} "${ref.id}".`));
  const next = clone(doc);
  const newId = options.newId || fallbackId;
  const assetMap = options.assets || {};
  const refs = closure(bundle, chosen);
  const needed = new Set<string>();
  refs.forEach(ref => referencesOf(ref.kind, find(lists, ref.kind, ref.id)).assets.forEach(id => needed.add(id)));
  const missing = [...needed].filter(id => !assetMap[id]);
  if (missing.length) throw new LibraryError([`Copy these images into the site first: ${missing.join(', ')}.`]);

  const renames: Renames = {};
  const items: ImportedItem[] = [];
  const target = listsOf(next);
  const links = [...(next.meta.libraryLinks || [])];
  // Decide every id first, so references can be rewritten in one pass.
  for (const kind of KINDS_IN_ORDER) {
    const taken = new Set((target[kind] as { id: string }[]).map(item => item.id));
    for (const ref of refs.filter(r => r.kind === kind)) {
      const existing = find(target, kind, ref.id);
      const linked = links.find(l => l.libraryId === source.libraryId && l.kind === kind && l.sourceId === ref.id);
      let localId = ref.id;
      let how: ImportedItem['how'] = 'added';
      // Already imported from this library: keep the site's copy and its link exactly as they
      // are. Changes arrive only through an update, which knows what this site changed.
      if (linked && find(target, kind, linked.localId)) { localId = linked.localId; how = 'linked'; }
      else if (existing && isFoundation(kind, ref.id)) how = 'site-foundation';
      else if (existing && itemHash(kind, existing) === bundle.hashes[key(kind, ref.id)]) how = 'reused';
      else if (existing) { localId = freeId(taken, ref.id); how = 'renamed'; }
      taken.add(localId);
      (renames[kind] ||= new Map()).set(ref.id, localId);
      items.push({ kind, sourceId: ref.id, localId, how });
    }
  }
  for (const entry of items) {
    if (entry.how !== 'added' && entry.how !== 'renamed') continue;
    const copy = rewrite(entry.kind, clone(find(lists, entry.kind, entry.sourceId)!), renames, assetMap) as { id: string; node?: Node };
    copy.id = entry.localId;
    if (copy.node) reidTree(copy.node, newId);
    place(next, entry.kind, copy);
  }
  for (const entry of items) {
    if (entry.how === 'site-foundation' || entry.how === 'linked') continue;
    const local = find(listsOf(next), entry.kind, entry.localId)!;
    const link: LibraryLink = {
      libraryId: source.libraryId, version: source.version, kind: entry.kind, sourceId: entry.sourceId,
      localId: entry.localId, sourceHash: bundle.hashes[key(entry.kind, entry.sourceId)], localHash: itemHash(entry.kind, local),
    };
    const at = links.findIndex(l => l.libraryId === link.libraryId && l.kind === link.kind && l.sourceId === link.sourceId);
    if (at >= 0) links[at] = link; else links.push(link);
  }
  next.meta.libraryLinks = links;
  return { doc: next, items, assets: [...needed].sort() };
}

/* ---- updates ------------------------------------------------------------- */

export type UpdateAction = 'none' | 'update' | 'conflict' | 'unlink';
export interface UpdateItem {
  kind: LibraryItemKind;
  sourceId: string;
  localId: string;
  action: UpdateAction;
  /** why: 'upstream-removed', 'deleted-here', 'changed-both', … */
  reason: string;
  warnings: string[];
}
export type Resolution = 'mine' | 'theirs';
export interface LibraryUpdatePlan {
  items: UpdateItem[];
  /** conflict keys (`${kind}:${sourceId}`) still waiting for a resolution */
  unresolved: string[];
  /** the updated document, or null while conflicts are unresolved */
  doc: Doc | null;
  /** library asset ids the chosen updates need copied into the site */
  assets: string[];
}

/** Every instance of component `id` anywhere in the document. */
function instancesOf(doc: Doc, id: string) {
  const found: Node[] = [];
  const visit = (node: Node) => eachNode(node, n => { if (n.use === id) found.push(n); });
  doc.pages.forEach(page => page.tree.forEach(visit));
  doc.header.forEach(visit);
  doc.footer.forEach(visit);
  (doc.meta.components || []).forEach(def => visit(def.node));
  doc.meta.blocks.forEach(block => visit(block.node));
  return found;
}
function slotNames(def: ComponentDef) {
  const names = new Set<string>();
  eachNode(def.node, n => { if (n.slot) names.add(n.slot); });
  return names;
}
function componentWarnings(doc: Doc, localId: string, before: ComponentDef, after: ComponentDef) {
  const warnings: string[] = [];
  const instances = instancesOf(doc, localId);
  const variants = new Set((after.variants || []).map(v => v.id));
  const props = new Set(after.props.map(p => p.k));
  const slots = slotNames(after);
  const firstSlot = [...slotNames(before)][0];
  const lostVariant = instances.filter(n => n.variant && !variants.has(n.variant)).length;
  const lostValues = instances.filter(n => Object.keys(n.vals || {}).some(k => !props.has(k))).length;
  const lostSlots = instances.filter(n => (n.children || []).some(child => {
    const name = child.slot || firstSlot;
    return name !== undefined && !slots.has(name);
  })).length;
  if (lostVariant) warnings.push(`${lostVariant} placement(s) use a variant this version removes; they fall back to the default.`);
  if (lostValues) warnings.push(`${lostValues} placement(s) set a property this version removes; those values are dropped.`);
  if (lostSlots) warnings.push(`${lostSlots} placement(s) put content in a slot this version removes; that content would disappear.`);
  return warnings;
}

/** Plan moving every item linked to `source.libraryId` to `bundle`, a newer version. */
export function planLibraryUpdate(
  doc: Doc, bundle: LibraryBundle, source: LibrarySource, resolutions: Record<string, Resolution> = {},
  options: LibraryImportOptions = {},
): LibraryUpdatePlan {
  const links = (doc.meta.libraryLinks || []).filter(l => l.libraryId === source.libraryId);
  const lists = bundleLists(bundle);
  const site = listsOf(doc);
  const items: UpdateItem[] = [];
  for (const link of links) {
    const local = find(site, link.kind, link.localId);
    const upstream = find(lists, link.kind, link.sourceId);
    const base = { kind: link.kind, sourceId: link.sourceId, localId: link.localId, warnings: [] as string[] };
    if (!local) { items.push({ ...base, action: 'unlink', reason: 'deleted-here' }); continue; }
    if (!upstream) { items.push({ ...base, action: 'unlink', reason: 'upstream-removed' }); continue; }
    const upstreamChanged = bundle.hashes[key(link.kind, link.sourceId)] !== link.sourceHash;
    const localChanged = itemHash(link.kind, local) !== link.localHash;
    if (!upstreamChanged) { items.push({ ...base, action: 'none', reason: 'unchanged' }); continue; }
    items.push({ ...base, action: localChanged ? 'conflict' : 'update', reason: localChanged ? 'changed-both' : 'changed-upstream' });
  }
  const unresolved = items.filter(i => i.action === 'conflict' && !resolutions[key(i.kind, i.sourceId)]).map(i => key(i.kind, i.sourceId));
  const taking = items.filter(i => i.action === 'update' || (i.action === 'conflict' && resolutions[key(i.kind, i.sourceId)] === 'theirs'));

  // Warnings are computed against what would be written, so they are known before resolving.
  const renames: Renames = {};
  for (const link of links) (renames[link.kind] ||= new Map()).set(link.sourceId, link.localId);
  for (const item of items.filter(i => i.kind === 'component' && (i.action === 'update' || i.action === 'conflict'))) {
    const before = find(site, 'component', item.localId) as ComponentDef;
    const after = rewrite('component', clone(find(lists, 'component', item.sourceId)!), renames) as ComponentDef;
    item.warnings = componentWarnings(doc, item.localId, before, after);
  }

  // Updated items may depend on things this site has never imported.
  const linkedKeys = new Set(links.map(l => key(l.kind, l.sourceId)));
  const newDeps = closure(bundle, taking.map(i => ({ kind: i.kind, id: i.sourceId }))).filter(ref => !linkedKeys.has(key(ref.kind, ref.id)));
  const needed = new Set<string>();
  [...taking.map(i => ({ kind: i.kind, id: i.sourceId })), ...newDeps]
    .forEach(ref => referencesOf(ref.kind, find(lists, ref.kind, ref.id)).assets.forEach(id => needed.add(id)));
  if (unresolved.length) return { items, unresolved, doc: null, assets: [...needed].sort() };

  const assetMap = options.assets || {};
  const missing = [...needed].filter(id => !assetMap[id]);
  if (missing.length) throw new LibraryError([`Copy these images into the site first: ${missing.join(', ')}.`]);
  const newId = options.newId || fallbackId;

  // New dependencies arrive exactly as an import would bring them.
  let next = clone(doc);
  if (newDeps.length) next = planLibraryImport(next, bundle, source, newDeps, options).doc;
  const nextLinks = next.meta.libraryLinks || [];
  const allRenames: Renames = {};
  for (const link of nextLinks.filter(l => l.libraryId === source.libraryId)) (allRenames[link.kind] ||= new Map()).set(link.sourceId, link.localId);

  for (const item of taking) {
    const copy = rewrite(item.kind, clone(find(lists, item.kind, item.sourceId)!), allRenames, assetMap) as { id: string; node?: Node };
    copy.id = item.localId;
    if (copy.node) reidTree(copy.node, newId);
    replaceItem(next, item.kind, item.localId, copy);
  }
  const touched = new Set(taking.map(i => key(i.kind, i.sourceId)));
  const kept = new Set(items.filter(i => i.action === 'conflict' && resolutions[key(i.kind, i.sourceId)] === 'mine').map(i => key(i.kind, i.sourceId)));
  const unlinked = new Set(items.filter(i => i.action === 'unlink').map(i => key(i.kind, i.sourceId)));
  next.meta.libraryLinks = nextLinks.filter(l => !(l.libraryId === source.libraryId && unlinked.has(key(l.kind, l.sourceId)))).map(l => {
    if (l.libraryId !== source.libraryId) return l;
    const k = key(l.kind, l.sourceId);
    const local = find(listsOf(next), l.kind, l.localId);
    if (touched.has(k) && local) return { ...l, version: source.version, sourceHash: bundle.hashes[k], localHash: itemHash(l.kind, local) };
    // Keeping mine records the new version as seen, and keeps my changes counted as mine.
    if (kept.has(k)) return { ...l, version: source.version, sourceHash: bundle.hashes[k] };
    return { ...l, version: Math.max(l.version, source.version), sourceHash: bundle.hashes[k] ?? l.sourceHash };
  });
  return { items, unresolved, doc: next, assets: [...needed].sort() };
}
