// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import { compileDocument } from '../packages/editor/src/compiler';
import { nestedOwnerFixture } from './fixtures/nested-component-ownership';
let f:ReturnType<typeof nestedOwnerFixture>;
beforeEach(()=>{f=nestedOwnerFixture();document.body.replaceChildren();});
const ids=(html:string)=>{document.body.innerHTML=html;return [...document.querySelectorAll('[id]')].map(n=>n.id);};
const unique=(html:string)=>{const all=ids(html);expect(new Set(all).size).toBe(all.length);return all;};

test('generated nested collisions gain stable placement paths while the first legacy ID and top-level IDs stay canonical',()=>{
 const html=C.renderList([f.placement,f.duplicate],{edit:false}),all=unique(html);
 expect(all).toContain(C.domIdOf(f.placement));expect(all).toContain(C.domIdOf(f.duplicate));
 expect(all.filter(id=>id===C.domIdOf(f.nested))).toHaveLength(1);
 expect(all).toContain(C.domIdOf(f.nested)+'-outerduplicate-firstmiddle');
 expect(C.renderList([f.placement,f.duplicate],{edit:false})).toBe(html);
});

test('omitted outer conditions and their descendants do not consume canonical IDs or reserve authored anchors',()=>{
 const show=C.propAdd(f.outer.id,'Show','bool','1')!;C.condSet(f.outer.node,{bind:{src:'prop',path:show},op:'set'});
 C.instSet(f.placement,show,'');C.instSet(f.duplicate,show,'1');
 const all=unique(C.renderList([f.placement,f.duplicate],{edit:false}));
 expect(all).not.toContain(C.domIdOf(f.placement));expect(all).toContain(C.domIdOf(f.nested));
 const hiddenBox=f.node('nhiddenbox','box',[f.node('nhiddenanchor')]);hiddenBox.children[0].adv.htmlId=C.domIdOf(f.nested);
 const col=C.collectionAdd('Visibility')!,field=C.fieldAdd(col.id,'Visible','bool')!,item=C.itemAdd(col.id)!;C.itemSet(col.id,item.id,field.id,'');C.condSet(hiddenBox,{bind:C.bindField(field.id)!,op:'set'});
 expect(ids(C.renderList([hiddenBox,f.duplicate],{edit:false,col,item}))).toContain(C.domIdOf(f.nested));
});

test('later authored anchors are reserved and literal fragment destinations keep their meaning',()=>{
 const anchor=f.node('nauthored');anchor.adv.htmlId=C.domIdOf(f.nested);
 const reservedPath=f.node('nreservedpath');reservedPath.adv.htmlId=anchor.adv.htmlId+'-outerplacement-firstmiddle';
 const link=f.node('nlink','button');link.props.link='#'+anchor.adv.htmlId;
 unique(C.renderList([f.placement,anchor,reservedPath,link],{edit:false}));
 expect(document.querySelector('.pagecraft-wysiwyg')?.id).toBe(reservedPath.adv.htmlId+'-2');
 expect(document.querySelector(`[id="${anchor.adv.htmlId}"]`)?.classList.contains(C.nodeClass(anchor))).toBe(true);
 expect(document.querySelector('a')?.getAttribute('href')).toBe('#'+anchor.adv.htmlId);
});

test('authored duplicate IDs remain explicit author data rather than being silently renamed',()=>{
 const first=f.node('ncustomone'),second=f.node('ncustomtwo');first.adv.htmlId=second.adv.htmlId='chosen-anchor';
 const all=ids(C.renderList([first,second],{edit:false}));expect(all).toEqual(['chosen-anchor','chosen-anchor']);
});

test('independent renderNode and renderList calls start deterministic fresh allocation sessions',()=>{
 const first=C.renderNode(f.placement,{edit:false}),again=C.renderNode(f.placement,{edit:false});
 expect(again).toBe(first);unique(first);expect(C.renderList([f.placement],{edit:false})).toBe(first);
});

test('public widgets omitted without conditions do not reserve authored anchors',()=>{
 const absent=f.node('nemptycode','code');absent.props.body='';absent.adv.htmlId=C.domIdOf(f.nested);
 unique(C.renderList([absent,f.placement],{edit:false}));
 expect(document.getElementById(C.domIdOf(f.nested))?.classList.contains('pagecraft-wysiwyg')).toBe(true);
});

test('full page and Preview-region batches share canonical IDs across header, body and footer',()=>{
 const header=C.clone(f.placement);header.id='nheaderplacement';const footer=C.clone(f.placement);footer.id='nfooterplacement';
 C.state.header=[header];C.state.footer=[footer];C.state.pages[0].tree=[f.placement];
 const batch=C.renderPublicLists([C.state.header,C.state.pages[0].tree,C.state.footer],{edit:false,canvas:true});
 const batchIds=unique(batch.join(''));const pageIds=unique(C.buildPage(C.state.pages[0]));
 expect(pageIds.filter(id=>id!=='pagecraft-main')).toEqual(batchIds);
 expect(batchIds.filter(id=>id===C.domIdOf(f.nested))).toHaveLength(1);
});

test('nested slots and collection copies have unique IDs while authored dimensions, styles and values stay unchanged',()=>{
 const col=C.collectionAdd('Copies')!,item1=C.itemAdd(col.id)!,item2=C.itemAdd(col.id)!;item1.slug='first';item2.slug='second';
 const listing=f.node('ncollection','list',[f.placement,f.duplicate]);C.srcSet(listing,col.id);const before=JSON.stringify(C.doc());
 unique(C.renderNode(listing,{edit:false}));expect(document.body.textContent).toContain('Nested slot value');
 expect(JSON.stringify(C.doc())).toBe(before);
});

function interactiveCopies(){
 const widgets=['nav','tabs','accordion','form','slider','gallery'].map(type=>{const n=C.N(type);n.id='nwidget'+type;return n;});
 widgets.find(n=>n.type==='accordion')!.props.single=1;
 widgets.find(n=>n.type==='gallery')!.props.items=[{src:'https://example.invalid/photo.webp',alt:'Photo'}];
 const slider=widgets.find(n=>n.type==='slider')!;slider.props.arrows=1;slider.children=[f.node('nslideone'),f.node('nslidetwo')];
 const widgetRoot=f.node('nwidgetroot','box',widgets),widgetDef={id:'widgets',name:'Widgets',node:widgetRoot,props:[]};
 const nested=f.use('nwidgetplacement',widgetDef),outerDef={id:'widgetouter',name:'Widget outer',node:f.node('nwidgetouterroot','box',[nested]),props:[]};
 C.components().push(widgetDef,outerDef);const one=f.use('nwidgetcopyone',outerDef),two=f.use('nwidgetcopytwo',outerDef);
 return {one,two,widgets};
}

test('repeated nested nav/tabs/forms relationships resolve exactly once and accordion groups stay independent',()=>{
 const {one,two}=interactiveCopies();unique(C.renderList([one,two],{edit:false}));
 for(const el of document.querySelectorAll('[aria-controls],[aria-labelledby],[aria-describedby],label[for]')){
  for(const attribute of ['aria-controls','aria-labelledby','aria-describedby','for']){
   for(const target of (el.getAttribute(attribute)||'').split(/\s+/).filter(Boolean)){
    expect([...document.querySelectorAll('[id]')].filter(n=>n.id===target),`${attribute}=${target}`).toHaveLength(1);
   }
  }
 }
 const groups=[...document.querySelectorAll('.pagecraft-accordion')].map(n=>n.querySelector('details')?.getAttribute('name'));
 expect(groups).toHaveLength(2);expect(new Set(groups).size).toBe(2);
 expect(document.querySelectorAll('[data-nav]')).toHaveLength(2);expect(document.querySelectorAll('[data-tabs]')).toHaveLength(2);
 expect(document.querySelectorAll('.pagecraft-gallery')).toHaveLength(2);expect(document.querySelectorAll('[data-slider]')).toHaveLength(2);
});


test.each([['nav','-menu'],['form','-f0'],['form','-status'],['tabs','-p0'],['tabs','-t0']])('nested %s relationships avoid a later authored %s anchor', (type,suffix)=>{
 const {one,widgets}=interactiveCopies(),widget=widgets.find(n=>n.type===type)!;
 const legacy=C.domIdOf(widget)+'-widgetplacement',anchor=f.node('nwidgetanchor');anchor.adv.htmlId=legacy+suffix;
 const fallback=f.node('nwidgetfallback');fallback.adv.htmlId=legacy+'-widgetcopyone'+suffix;
 unique(C.renderList([one,anchor,fallback],{edit:false}));
 expect(document.querySelector('.'+C.nodeClass(widget))?.id).toBe(legacy+'-widgetcopyone-2');
 expect(document.getElementById(anchor.adv.htmlId)?.classList.contains(C.nodeClass(anchor))).toBe(true);
 for(const el of document.querySelectorAll('[aria-controls],[aria-labelledby],[aria-describedby],label[for]')){
  for(const attribute of ['aria-controls','aria-labelledby','aria-describedby','for']){
   for(const target of (el.getAttribute(attribute)||'').split(/\s+/).filter(Boolean)){
    expect([...document.querySelectorAll('[id]')].filter(n=>n.id===target),`${attribute}=${target}`).toHaveLength(1);
   }
  }
 }
});

test('nested custom mobile-menu content avoids a later authored anchor',()=>{
 const {one,widgets}=interactiveCopies(),nav=widgets.find(n=>n.type==='nav')!;C.ensureMobileMenuComponent(nav);
 const legacy=C.domIdOf(nav)+'-widgetplacement',anchor=f.node('nmobileanchor');anchor.adv.htmlId=legacy+'-menu-content';
 unique(C.renderList([one,anchor],{edit:false}));
 const rendered=document.querySelector('[data-nav]')!;
 expect(rendered.id).toBe(legacy+'-widgetcopyone');
 expect(rendered.querySelector('[data-nav-t]')?.getAttribute('aria-controls')).toBe(rendered.id+'-menu-content');
 expect(document.getElementById(anchor.adv.htmlId)?.classList.contains(C.nodeClass(anchor))).toBe(true);
});

test.each(['managed-nav','active-form'])('non-emitted derived IDs do not displace the canonical %s root',mode=>{
 const {one,widgets}=interactiveCopies(),widget=widgets.find(n=>n.type===(mode==='managed-nav'?'nav':'form'))!;
 if(mode==='managed-nav')widget.props.managedMobileLinks=1;
 else {widget.props.mode='external';widget.props.action='https://example.invalid/receive';}
 const legacy=C.domIdOf(widget)+'-widgetplacement',anchor=f.node('nunemittedanchor');anchor.adv.htmlId=legacy+(mode==='managed-nav'?'-menu':'-status');
 unique(C.renderList([one,anchor],{edit:false}));
 expect(document.querySelector('.'+C.nodeClass(widget))?.id).toBe(legacy);
 expect(document.getElementById(anchor.adv.htmlId)?.classList.contains(C.nodeClass(anchor))).toBe(true);
});

test('standalone compiler keeps the same full-page public identity map without mutating the open document',async()=>{
 C.state.meta.font='system-ui';C.state.meta.headFont='';const header=C.clone(f.placement);header.id='ncompileheader';C.state.header=[header];
 const page=C.state.pages[0],input=C.clone(C.doc()),expected=ids(C.buildPage(page));const before=JSON.stringify(C.doc());
 const compiled=await compileDocument(input,{pageId:page.id,assets:{}},{fetch:async()=>new Response("/* latin */\n@font-face{font-family:'Inter';font-style:normal;font-weight:400;src:url(https://fonts.gstatic.com/inter.woff2) format('woff2')}"),crypto:globalThis.crypto});
 expect(unique(compiled.html)).toEqual(expected);expect(JSON.stringify(C.doc())).toBe(before);
});


test('nested authored IDs and node CSS classes remain author-controlled even when duplicated',()=>{
 f.nested.adv.htmlId='authored-inner';const before=C.treeCss([[f.placement,f.duplicate]],false);
 const output=C.renderList([f.placement,f.duplicate],{edit:false});ids(output);
 expect(document.querySelectorAll('[id="authored-inner"]')).toHaveLength(4);
 expect(document.querySelectorAll('.'+C.nodeClass(f.nested))).toHaveLength(4);
 expect(C.treeCss([[f.placement,f.duplicate]],false)).toBe(before);
});

test('a hidden first collection item leaves no IDs behind and later visible nested copies keep canonical anchors',()=>{
 const col=C.collectionAdd('Conditional copies')!,show=C.fieldAdd(col.id,'Show','bool')!,first=C.itemAdd(col.id)!,second=C.itemAdd(col.id)!;
 first.slug='hidden';second.slug='visible';C.itemSet(col.id,first.id,show.id,'');C.itemSet(col.id,second.id,show.id,'1');
 C.condSet(f.outer.node,{bind:C.bindField(show.id)!,op:'set'});
 const listing=f.node('nconditionallist','list',[f.placement]);C.srcSet(listing,col.id);
 const all=unique(C.renderNode(listing,{edit:false}));
 expect(all).not.toContain(C.domIdOf(f.placement)+'-hidden');expect(all).toContain(C.domIdOf(f.placement)+'-visible');
 expect(all).toContain(C.domIdOf(f.nested)+'-visible');expect(document.querySelectorAll('.'+C.nodeClass(f.placement))).toHaveLength(1);
});
