// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

beforeEach(()=>{C.seed();C.state.ui=C.initUi();C.blankProject('Empty Rich selection QA');C.state.meta.components=[];document.head.replaceChildren();document.body.replaceChildren();});
const render=(node:ReturnType<typeof C.N>,edit=true)=>{document.body.innerHTML=C.renderNode(node,{edit});return document.body.firstElementChild as HTMLElement;};
function component(){
 const root=C.N('text',{html:'<p></p>'});C.state.pages[0].tree=[root];
 const id=C.componentFromNode(root.id,'Empty Rich')!,def=C.findComponent(id)!,inst=C.locate(root.id)!.node;
 const prop=C.propAdd(id,'Text','rich','<p></p>')!;C.bindSet(def.node,'html',{src:'prop',path:prop});
 return {root:def.node,inst,def,prop};
}

test('empty Rich component placements and definition roots retain their existing selection owner with an editor hit area',()=>{
 const {root,inst}=component();
 const placed=render(inst);expect(placed.classList.contains('s-rich-empty')).toBe(true);
 expect(placed.id).toBe(inst.id);expect(placed.dataset.id).toBe(inst.id);
 expect(placed.querySelector('[data-id]')).toBeNull();expect(placed.innerHTML).toBe('<p></p>');
 const source=render(root);expect(source.classList.contains('s-rich-empty')).toBe(true);expect(source.dataset.id).toBe(root.id);
});

test('false conditions keep empty Rich editable while public hidden and empty markup remains exact',()=>{
 const {root,inst,def,prop}=component();C.condSet(root,{bind:{src:'prop',path:prop},op:'set'});
 const editor=render(inst);expect(editor.classList.contains('s-cond-off')).toBe(true);expect(editor.classList.contains('s-rich-empty')).toBe(true);
 expect(C.renderNode(inst,{edit:false})).toBe('');
 C.instSet(inst,prop,'<p>Words</p>');const filled=render(inst);expect(filled.classList.contains('s-rich-empty')).toBe(false);expect(filled.classList.contains('s-cond-off')).toBe(false);
 C.condSet(root,null);C.instSet(inst,prop,'<p></p>');
 const publicNode=render(inst,false);expect(publicNode.classList.contains('s-rich-empty')).toBe(false);expect(publicNode.innerHTML).toBe('<p></p>');expect(publicNode.hasAttribute('data-id')).toBe(false);
 expect(C.showsNode(root,null,null,inst,def)).toBe(true);
});

test('ordinary empty Rich uses a nonserialized editor affordance while populated Rich stays unchanged',()=>{
 const node=C.N('text',{html:'<p><strong></strong></p>'});const before=JSON.stringify(node);
 expect(render(node).classList.contains('s-rich-empty')).toBe(true);expect(JSON.stringify(node)).toBe(before);
 node.props.html='<p><strong>Words</strong></p>';expect(render(node).classList.contains('s-rich-empty')).toBe(false);
});

test('nested and duplicate component placements retain unique IDs and only placement selection hooks',()=>{
 const {inst,def}=component();const second=C.instanceInsert(def.id)!;
 const box=C.N('box',{},undefined,[inst,second]);const root=render(box);
 const ids=[...root.querySelectorAll('[id]')].map(n=>n.id);expect(new Set(ids).size).toBe(ids.length);
 expect(root.querySelectorAll('.s-rich-empty')).toHaveLength(2);expect(root.querySelectorAll('.s-rich-empty[data-id]')).toHaveLength(2);
});

test('empty Rich inside a component keeps its hit area owned by the placement rather than the definition child',()=>{
 const text=C.N('text',{html:'<p></p>'}),box=C.N('box',{},undefined,[text]);C.state.pages[0].tree=[box];
 const id=C.componentFromNode(box.id,'Nested empty Rich')!,inst=C.locate(box.id)!.node;
 expect(inst.use).toBe(id);
 const placed=render(inst),inner=placed.querySelector<HTMLElement>('.s-rich-empty')!;
 expect(inner).not.toBeNull();expect(inner.hasAttribute('data-id')).toBe(false);
 expect(inner.closest('[data-id]')).toBe(placed);expect(placed.dataset.id).toBe(inst.id);
 expect(render(inst,false).querySelector('.s-rich-empty')).toBeNull();
});

test('hit area CSS is editor-only and does not override authored root sizes or overflow',()=>{
 const editor=C.baseCss(true),published=C.baseCss(false);
 expect(editor).toContain('.s-rich-empty::after');expect(published).not.toContain('s-rich-empty');
 const rule=editor.match(/\.s-rich-empty::after\{([^}]+)\}/)![1];
 expect(rule).toContain('height:24px');expect(rule).not.toMatch(/!important/);
 const node=C.N('text',{html:'<p></p>'},{d:{height:'10px','max-height':'10px',overflow:'hidden'},t:{height:'8px'},m:{height:'6px'}});
 const before=C.treeCss([[node]],true);render(node);expect(C.treeCss([[node]],true)).toBe(before);
 expect(before).toContain('height:10px');expect(before).toContain('overflow:hidden');
});
