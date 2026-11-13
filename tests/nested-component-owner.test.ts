// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import * as C from '../app/src/core/index';
import { nestedOwnerFixture } from './fixtures/nested-component-ownership';
let f:ReturnType<typeof nestedOwnerFixture>;
beforeEach(()=>{f=nestedOwnerFixture();document.body.replaceChildren();});
const render=(node=f.placement)=>{document.body.innerHTML=C.renderNode(node,{edit:true});return document.body.firstElementChild as HTMLElement;};

test('nested component roots delegate native selection to their actual outer placement',()=>{
 const root=render();const nested=root.querySelector<HTMLElement>('.pagecraft-wysiwyg')!;
 expect(nested.textContent).toBe('Nested value');expect(nested.hasAttribute('data-id')).toBe(false);
 expect(nested.closest('[data-id]')).toBe(root);expect(root.dataset.id).toBe(f.placement.id);
 expect(C.locate(f.nested.id)).toBeNull();expect(C.locate(root.dataset.id!)?.node).toBe(f.placement);
});

test('two outer copies and repeated nested definitions have unique editor DOM IDs',()=>{
 document.body.innerHTML=C.renderList([f.placement,f.duplicate],{edit:true});
 const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);expect(new Set(ids).size).toBe(ids.length);
 expect([...document.querySelectorAll('[data-id]')].map(n=>n.getAttribute('data-id'))).toEqual([f.placement.id,f.duplicate.id]);
});

test('opening the outer definition makes its immediate nested placements selectable, without exposing their internals',()=>{
 expect(C.componentOpen(f.outer.id)).toBe(true);const root=render(f.outer.node);
 expect(root.querySelector(`[data-id="${f.first.id}"]`)).not.toBeNull();expect(root.querySelector(`[data-id="${f.second.id}"]`)).not.toBeNull();
 expect(root.querySelector(`[data-id="${f.nested.id}"]`)).toBeNull();
});

test('filled slots keep page-owned placements selectable but not definition-owned nested slot content',()=>{
 const nestedRoot=render();const nestedSlot=[...nestedRoot.querySelectorAll('.pagecraft-wysiwyg')].find(n=>n.textContent==='Nested slot value')!;
 expect(nestedSlot.hasAttribute('data-id')).toBe(false);expect(nestedSlot.closest('[data-id]')).toBe(nestedRoot);
 const direct=f.use('npageownedmiddle',f.middle),pageChild=f.use('npageownedleaf',f.leaf);direct.children=[pageChild];C.state.pages[0].tree=[direct];
 const directRoot=render(direct);expect(directRoot.querySelector(`[data-id="${pageChild.id}"]`)).not.toBeNull();
});

test('nested missing and cyclic fallbacks keep outer selection ownership',()=>{
 f.nested.use='missing';let root=render();expect(root.querySelector('.s-missing')?.closest('[data-id]')).toBe(root);
 f.nested.use=f.outer.id;root=render();expect(root.querySelector('.s-missing')?.closest('[data-id]')).toBe(root);
});

test('nested properties, variants and document data remain untouched by editor ownership',()=>{
 C.variantFromInstance(f.nested,'Named');const before=JSON.stringify(C.doc());
 expect(render().textContent).toContain('Nested value');expect(JSON.stringify(C.doc())).toBe(before);
});

test('nested CMS bindings still resolve against the nested instance rather than its outer selection owner',()=>{
 const col=C.collectionAdd('Nested values')!,field=C.fieldAdd(col.id,'Rich words','rich')!,item=C.itemAdd(col.id)!;
 C.itemSet(col.id,item.id,field.id,'<p>CMS nested value</p>');C.bindSet(f.nested,C.VAL+'text',C.bindField(field.id));
 document.body.innerHTML=C.renderNode(f.placement,{edit:true,col,item});
 const inner=[...document.querySelectorAll('.pagecraft-wysiwyg')].find(n=>n.textContent==='CMS nested value')!;
 expect(inner).not.toBeNull();expect(inner.closest('[data-id]')?.getAttribute('data-id')).toBe(f.placement.id);
 expect(inner.hasAttribute('data-id')).toBe(false);
});

test('public content and first legacy anchors stay compatible while duplicate generated IDs are repaired',()=>{
 const reference=JSON.parse(readFileSync('tests/fixtures/nested-component-public.json','utf8'));
 const check=(html:string,before:string)=>{
  const identityFree=(value:string)=>value.replace(/\sid="[^"]*"/g,'');
  expect(identityFree(html)).toBe(identityFree(before));
  const oldIds=[...before.matchAll(/\sid="([^"]*)"/g)].map(m=>m[1]);
  const newIds=[...html.matchAll(/\sid="([^"]*)"/g)].map(m=>m[1]);
  expect(new Set(newIds).size).toBe(newIds.length);
  for(const id of new Set(oldIds))expect(newIds.filter(value=>value===id)).toHaveLength(1);
 };
 check(C.renderList([f.placement,f.duplicate],{edit:false}),reference.normal);
 f.nested.use='missing';check(C.renderNode(f.placement,{edit:false}),reference.missing);
 f.nested.use=f.outer.id;check(C.renderNode(f.placement,{edit:false}),reference.cyclic);
});
