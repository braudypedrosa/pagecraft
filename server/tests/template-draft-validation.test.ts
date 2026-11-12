import { describe, it, expect } from 'vitest';
import { buildTemplateStarter } from '../../premade-sites/lib/authoring.ts';
import * as Core from '../../app/src/core/index.ts';
import { validateTemplateDraftDocument } from '../src/template-draft-validation.ts';

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
});
