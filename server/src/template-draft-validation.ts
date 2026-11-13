import * as Core from '../../app/src/core/index.ts';
import { adoptHostDocument, DocumentSchemaError } from '../../app/src/host/schema.ts';
import type { Doc, Node } from '../../app/src/core/types.ts';

export const TEMPLATE_DRAFT_WIDGETS = new Set(['section','row','list','slider','column','box','heading','text','quote','image','gallery','video','icon','tabs','table','crumbs','button','nav','form','accordion','spacer','divider']);
const nodeKeys = new Set(['id','type','props','css','st','anim','hide','cls','adv','children','use','vals','variant','slot','bind']);
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (message: string): never => { throw new Error(`invalid template document: ${message}`); };

/** Keep the tabs relation independent from editor/runtime migrations. Schema 15 adds editable
 * panels as normal direct box children; the older text-only relation remains immutable. */
export function validateNativeTabRelations(input: unknown): void {
  if (!object(input)) return;
  const raw = input as Record<string, any>;
  const schema = raw.schemaVersion ?? raw.v ?? 1;
  const roots: unknown[] = [raw.header, raw.footer];
  if (Array.isArray(raw.pages)) for (const page of raw.pages) roots.push(object(page) ? page.tree : undefined);
  if (object(raw.meta)) {
    if (Array.isArray(raw.meta.blocks)) for (const block of raw.meta.blocks) roots.push(object(block) ? [block.node] : undefined);
    if (Array.isArray(raw.meta.components)) for (const component of raw.meta.components) roots.push(object(component) ? [component.node] : undefined);
  }
  let visited = 0;
  const visit = (value: unknown, depth = 0): void => {
    if (!Array.isArray(value)) return;
    if (depth > 20) fail('tab relation tree is too deep');
    for (const candidate of value) {
      if (!object(candidate)) continue;
      if (++visited > 10000) fail('tab relation tree has too many nodes');
      const children = candidate.children === undefined ? [] : candidate.children;
      if (candidate.type === 'tabs') {
        if (!Array.isArray(children)) fail('tabs children must be an array');
        const items = candidate.props?.items;
        if (!Array.isArray(items)) fail('tabs items must be an array');
        const legacy = items.every((item: unknown) => object(item) && !('panelId' in item)
          && (item.panel === undefined || typeof item.panel === 'string'));
        const rich = items.every((item: unknown) => object(item) && typeof item.panelId === 'string' && !('panel' in item));
        if (legacy) {
          if (children.length) fail('text tabs cannot have child panels');
        } else if (rich) {
          if (!Number.isInteger(schema) || schema < 15) fail('editable tabs require schema 15 or newer');
          const refs: string[] = items.map((item: Record<string, unknown>) => item.panelId as string);
          if (refs.some((ref: string) => !ref) || new Set(refs).size !== refs.length) fail('editable tabs require unique panel references');
          if (children.length !== refs.length || children.some((child: unknown) => !object(child) || child.type !== 'box')) {
            fail('editable tabs require one direct box child per item');
          }
          const childIds: unknown[] = children.map((child: Record<string, unknown>) => child.id);
          if (childIds.some((id: unknown) => typeof id !== 'string') || new Set(childIds).size !== childIds.length
            || refs.some((ref: string) => !childIds.includes(ref))) fail('editable tabs panel references must match every direct child');
        } else {
          fail('tabs cannot mix text panels and editable panel references');
        }
      }
      visit(children, depth + 1);
    }
  };
  for (const root of roots) visit(root);
}

/** Validates a curated, portable native document. This is deliberately stricter than the editor. */
export function validateTemplateDraftDocument(input: unknown, assetIds: readonly string[] = []): Doc {
  if (!object(input) || Object.keys(input).some(k => !['schemaVersion','meta','header','footer','pages'].includes(k))) fail('unknown document field');
  if (JSON.stringify(input).length > 4_000_000) fail('document too large');
  const raw = input as Record<string, any>;
  validateNativeTabRelations(raw);
  if (!object(raw.meta) || Object.keys(raw.meta).some(k => !['name','maxWidth','font','headFont','size','css','headHtml','lang','baseUrl','ogImage','favicon','blocks','components','collections','selfHostFonts','tokens','libraryLinks'].includes(k))) fail('unknown meta field');
  let doc: Doc;
  try { doc = adoptHostDocument(input as Record<string, unknown>); }
  catch (error) { if (error instanceof DocumentSchemaError) return fail(error.message); throw error; }
  const meta = doc.meta as unknown as Record<string, any>;
  if (!object(meta) || meta.css || meta.headHtml || (meta.collections || []).length) fail('custom code or CMS is unsupported');
  if (!Array.isArray(doc.pages) || !doc.pages.length || doc.pages.length > 100 || !Array.isArray(doc.header) || !Array.isArray(doc.footer)) fail('invalid pages');
  const slugs = new Set<string>(), ids = new Set<string>();
  let count = 0;
  const scanValues = (v: unknown, key = ''): void => {
    if (typeof v === 'string') {
      if (/<\s*\/?\s*(script|iframe|object|embed|style|svg|math|link|meta|form)\b|\bon[a-z]+\s*=|javascript\s*:|data\s*:\s*text\/html|expression\s*\(|@import/i.test(v)) fail('unsafe content');
      if (/^(action|href|src|link|url)$/i.test(key) && /^(?!https?:|mailto:|tel:|asset:|\/|#|\.|$)[a-z][a-z0-9+.-]*:/i.test(v.trim())) fail('unsafe URL');
      for (const match of v.matchAll(/asset:([a-z0-9]+(?:-[a-z0-9]+)*)/g)) if (!assetIds.includes(match[1])) fail(`unknown asset ${match[1]}`);
    } else if (Array.isArray(v)) v.forEach(x => scanValues(x, key));
    else if (object(v)) for (const [k,x] of Object.entries(v)) { if (/^on[a-z]+$/i.test(k) || ['__proto__','constructor','prototype'].includes(k)) fail('unsafe field'); scanValues(x,k); }
  };
  const cssValue = (value: unknown): void => {
    if (typeof value === 'string') {
      if (/[\\{};\x00-\x1f]/.test(value)) fail('unsafe CSS');
      for (const match of value.matchAll(/url\s*\(([^)]*)\)/gi)) {
        const target=match[1].trim().replace(/^[\"']|[\"']$/g,'');
        if (!/^asset:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target)) fail('external CSS URL');
      }
    } else if (object(value)) for (const [key, part] of Object.entries(value)) {
      if (!/^(?:--[a-zA-Z0-9_-]+|[a-z][a-z0-9-]*|d|t|m|hover|focus)$/.test(key)) fail('invalid CSS property');
      cssValue(part);
    } else fail('invalid CSS value');
  };
  const safeIdentifier = (value:unknown) => typeof value === 'string' && /^[a-zA-Z0-9_-]*$/.test(value);
  const shape = (value:unknown, keys:string[], label:string) => {
    if (!object(value) || Object.keys(value).some(k => !keys.includes(k))) fail(`invalid ${label}`);
  };
  for (const key of ['name','maxWidth','font','headFont','size','lang','baseUrl','ogImage','favicon','css','headHtml']) {
    if (typeof meta[key] !== 'string') fail(`invalid meta ${key}`);
  }
  for (const key of ['font','headFont','maxWidth','size']) if (/[\\{};<>\x00-\x1f]|url\s*\(/i.test(meta[key])) fail(`unsafe meta ${key}`);
  if (meta.tokens) {
    shape(meta.tokens,['colors','text','classes'],'tokens');
    if (![meta.tokens.colors,meta.tokens.text,meta.tokens.classes].every(Array.isArray)) fail('invalid tokens');
    for (const color of meta.tokens.colors) { shape(color,['id','name','value'],'color'); if (!safeIdentifier(color.id) || !color.id || typeof color.name !== 'string' || typeof color.value !== 'string') fail('invalid color'); cssValue(color.value); }
    for (const item of meta.tokens.text) { shape(item,['id','name','tag','css'],'text style'); if (!safeIdentifier(item.id) || !item.id || typeof item.name !== 'string') fail('invalid text style'); }
    for (const item of meta.tokens.classes) { shape(item,['id','name','css','st'],'style class'); if (!safeIdentifier(item.id) || !item.id || typeof item.name !== 'string') fail('invalid style class'); }
  }
  const walk = (nodes: Node[], parent: string | null, depth: number) => {
    if (!Array.isArray(nodes) || depth > 20) fail('invalid tree');
    for (const node of nodes) {
      if (!object(node) || Object.keys(node).some(k => !nodeKeys.has(k))) fail('unknown node field');
      if (++count > 10000 || !safeIdentifier(node.id) || !node.id || ids.has(node.id)) fail('duplicate or invalid node id');
      ids.add(node.id);
      if (node.bind && Object.values(node.bind).some((binding: any) => !object(binding) || binding.src !== 'prop')) fail('CMS binding unsupported');
      if (!TEMPLATE_DRAFT_WIDGETS.has(node.type) || (parent && !Core.holds(parent, node.type))) fail('unsupported widget or nesting');
      if (!object(node.props) || !object(node.css) || !['d','t','m'].every(bp => object((node.css as any)[bp])) || !object(node.adv) || node.adv.css) fail('invalid styles');
      shape(node.adv,['htmlId','cls','css'],'advanced settings');
      if (!safeIdentifier(node.adv.htmlId) || typeof node.adv.cls !== 'string' || !/^[a-zA-Z0-9_ -]*$/.test(node.adv.cls)) fail('unsafe advanced settings');
      if (!object(node.hide) || Object.keys(node.hide).some(k=>!['d','t','m'].includes(k)) || Object.values(node.hide).some(v=>typeof v !== 'boolean')) fail('invalid visibility');
      if (!Array.isArray(node.cls) || node.cls.some(v=>!safeIdentifier(v))) fail('invalid classes');
      for (const key of ['use','slot','variant'] as const) if (node[key] !== undefined && !safeIdentifier(node[key])) fail('invalid component reference');
      if (node.anim) {
        shape(node.anim,['name','dur','delay','ease','once'],'animation');
        for (const key of ['name','dur','delay','ease'] as const) if (node.anim[key] !== undefined && (typeof node.anim[key] !== 'string' || !/^[a-zA-Z0-9 .,_()-]*$/.test(node.anim[key]!))) fail('invalid animation');
        if (node.anim.once !== undefined && node.anim.once !== 0 && node.anim.once !== 1) fail('invalid animation');
      }
      if (node.bind) for (const binding of Object.values(node.bind)) { shape(binding,['src','path'],'binding'); if (!safeIdentifier(binding.path)) fail('invalid binding'); }
      const nested: Record<string,string[]> = {gallery:['src','alt','caption','w','h'],tabs:['label','panel','panelId'],accordion:['q','a'],nav:['id','label','href','pageId','parentId','cls','target','rel','objectType','objectId','anchor'],form:['type','label','name','ph','opts','required','half','width']};
      const list = node.type === 'form' ? node.props.fields : node.props.items;
      if (list !== undefined && nested[node.type]) { if (!Array.isArray(list) || list.length > 500) fail('invalid items'); for (const item of list) { shape(item,nested[node.type],'item'); if (Object.values(item).some(v=>!['string','number','boolean'].includes(typeof v))) fail('invalid item value'); } }
      const allowedProps = new Set([...Object.keys(Core.DEF[node.type].make().props), ...Core.ctlKeys(node.type), 'link', 'target', 'ts']);
      if (Object.keys(node.props).some(key => !allowedProps.has(key) || key.startsWith('_'))) fail('unknown widget property');
      cssValue(node.css); if(node.st) cssValue(node.st);
      if (node.type === 'form' && (node.props.action || (node.props.mode && node.props.mode !== 'external'))) fail('form destination must be unconfigured');
      if (node.type === 'form' && node.props.method && String(node.props.method).toLowerCase() !== 'post') fail('form method unsupported');
      scanValues(node.props); scanValues(node.css); scanValues(node.st); scanValues(node.vals); scanValues(node.adv); scanValues(node.anim); scanValues(node.hide); scanValues(node.cls); scanValues(node.bind); scanValues(node.use); scanValues(node.slot);
      walk(node.children, node.type, depth + 1);
    }
  };
  for (const page of doc.pages) {
    if (!object(page) || Object.keys(page).some(k => !['id','name','slug','title','desc','ogImage','tree','headHtml'].includes(k)) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug) || slugs.has(page.slug)) fail('invalid page');
    if (!safeIdentifier(page.id) || !page.id) fail('invalid page id');
    if (page.headHtml) fail('page head markup unsupported');
    slugs.add(page.slug); walk(page.tree, null, 0);
  }
  if (!slugs.has('index')) fail('missing index');
  walk(doc.header, null, 0); walk(doc.footer, null, 0);
  for (const item of doc.meta.components || []) {
    shape(item,['id','name','node','props','variants','mobileMenu','mobileMenuSource'],'component');
    if (!safeIdentifier(item.id) || !item.id || typeof item.name !== 'string') fail('invalid component');
    if (!Array.isArray(item.props) || item.props.length > 500) fail('invalid component properties');
    for (const prop of item.props) { shape(prop,['k','label','t','def','opts'],'component property'); if (!safeIdentifier(prop.k)) fail('invalid component property'); }
    for (const variant of item.variants || []) shape(variant,['id','name','values'],'variant');
    walk([item.node], null, 0);
  }
  for (const item of doc.meta.blocks || []) { shape(item,['id','name','node'],'block'); walk([item.node], null, 0); }
  for (const entry of [...(meta.tokens?.text || []), ...(meta.tokens?.classes || [])]) { if (entry.css) cssValue(entry.css); if (entry.st) cssValue(entry.st); }
  scanValues(meta);
  return doc;
}
