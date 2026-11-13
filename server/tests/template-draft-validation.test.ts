import { describe, it, expect } from 'vitest';
import { buildTemplateStarter } from '../../premade-sites/lib/authoring.ts';
import * as Core from '../../app/src/core/index.ts';
import { validateNativeTabRelations, validateTemplateDraftDocument } from '../src/template-draft-validation.ts';

describe('template document validation',()=>{
  it('accepts a native starter and rejects scripts and CMS',()=>{
    const doc=buildTemplateStarter('Example'); expect(validateTemplateDraftDocument(doc)).toBeTruthy();
    const unsafe=structuredClone(doc); unsafe.meta.headHtml='<script>alert(1)</script>'; expect(()=>validateTemplateDraftDocument(unsafe)).toThrow();
    const page=structuredClone(doc); page.pages[0].headHtml='<script>alert(1)</script>'; expect(()=>validateTemplateDraftDocument(page)).toThrow();
  });
  it('accepts native controls and refuses executable fields, network CSS and form destinations',()=>{
    const doc=buildTemplateStarter('Example');
    const heading=Core.N('heading',{text:'Welcome'});
    const form=Core.N('form',{fields:[],submit:'Send',action:'',method:'post'});
    const col=Core.N('column',{}, {},[heading,form]);
    doc.pages[0].tree=[Core.N('section',{}, {},[Core.N('row',{}, {},[col])])];
    expect(validateTemplateDraftDocument(doc)).toBeTruthy();
    const mutate=(fn:(d:typeof doc)=>void) => { const copy=structuredClone(doc); fn(copy); expect(()=>validateTemplateDraftDocument(copy)).toThrow(); };
    mutate(d=>{(d.pages[0].tree[0].props as any).unexpected='bad';});
    mutate(d=>{d.pages[0].tree[0].css.d.background='url(https://example.com/a.png)';});
    mutate(d=>{(d.pages[0].tree[0].children[0].children[0].children[1].props as any).action='https://example.com/post';});
    mutate(d=>{d.pages[0].tree[0].children[0].children[0].children[0].type='embed';});
    mutate(d=>{(d.pages[0].tree[0].adv as any).onmouseover='alert(1)';});
    mutate(d=>{d.pages[0].tree[0].adv.htmlId='x\" onmouseover=\"alert(1)';});
    mutate(d=>{d.pages[0].tree[0].anim={name:'fade',ease:'ease; background:url(https://evil.test)'};});
    mutate(d=>{d.meta.font='Arial; background:url(https://evil.test)';});
    mutate(d=>{(d.pages[0].tree[0].children[0].children[0].children[1].props.fields as any)=[{name:'email',onfocus:'alert(1)'}];});
  });
  it('keeps text tabs childless and validates schema 15 editable tabs as a one-to-one direct-box relation',()=>{
    const tabs=(items:unknown[],children:unknown[]=[])=>({schemaVersion:15,pages:[{tree:[{type:'tabs',id:'tabs',props:{items},children}]}]});
    validateNativeTabRelations(tabs([{label:'Care',panelId:'care-panel'}],[{type:'box',id:'care-panel',children:[]}]));
    validateNativeTabRelations(tabs([{label:'Care',panel:'Plain text'}]));
    validateNativeTabRelations(tabs([{label:'Care'}]));
    const bad=(document:unknown)=>expect(()=>validateNativeTabRelations(document)).toThrow();
    bad(tabs([{label:'Care',panelId:'care-panel'}]));
    bad(tabs([{label:'Care',panelId:'care-panel'},{label:'Visit',panelId:'care-panel'}],[{type:'box',id:'care-panel',children:[]}]));
    bad(tabs([{label:'Care',panelId:'care-panel'}],[{type:'box',id:'orphan',children:[]}]));
    bad(tabs([{label:'Care',panelId:'care-panel',panel:'mixed'}],[{type:'box',id:'care-panel',children:[]}]));
    bad(tabs([{label:'Care',panelId:'care-panel'}],[{type:'section',id:'care-panel',children:[]}]));
    bad({ ...tabs([{label:'Care',panelId:'care-panel'}],[{type:'box',id:'care-panel',children:[]}]), schemaVersion:14 });
    let deep:any={type:'box',id:'care-panel',children:[]};
    const deepRoot=deep;
    for(let index=0;index<21;index++){const child={type:'box',id:`nested-${index}`,children:[]};deep.children=[child];deep=child;}
    bad(tabs([{label:'Care',panelId:'care-panel'}],[deepRoot]));
    bad({schemaVersion:15,pages:[{tree:Array.from({length:10001},(_,index)=>({type:'text',id:`node-${index}`,children:[]}))}]});
  });
});
