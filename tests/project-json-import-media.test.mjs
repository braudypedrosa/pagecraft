import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import * as C from '../app/src/core/index';
import { installActionFeedback } from '../shared/action-feedback.js';

const source = readFileSync(new URL('../builder.html', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('function parseProjectImport('), source.indexOf('\nfunction exportModal()', source.indexOf('function parseProjectImport(')));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function documents() {
  C.blankProject('Target');
  C.state.meta.tokens = C.defaultTokens();
  C.state.meta.components = []; C.state.meta.blocks = []; C.state.meta.collections = [];
  const target = C.clone(C.doc());
  const candidate = C.clone(target);
  candidate.meta.name = 'Imported project';
  const image = C.N('image', { src: 'asset:foreign-one', alt: 'Forest' });
  const gallery = C.N('gallery', { items: [{ src: 'asset:foreign-two@640', alt: 'Lake' }] });
  candidate.pages[0].tree = [image, gallery];
  candidate.meta.collections = [{ id:'cabins', name:'Cabins', slug:'cabins', fields:[{id:'image',name:'Image',type:'image'}], items:[{id:'cabin',slug:'forest',values:{image:'asset:foreign-one'}}] }];
  candidate.meta.components = [{ id:'card',name:'Card',node:C.N('image', {src:'asset:foreign-two'}),props:[{k:'photo',t:'img',def:'asset:foreign-one'}],variants:[{id:'one',name:'One',values:{photo:'asset:foreign-two'}}] }];
  candidate.meta.blocks = [{id:'block',name:'Saved block',node:C.N('image', {src:'asset:foreign-one'})}];
  candidate.meta.tokens.classes = [{ id:'shared',name:'Shared',css:{d:{background:'url("asset:foreign-two@320")'},t:{},m:{}} }];
  return { target, candidate };
}
function fixture({ owns = [], save = true, saveThrows = false } = {}) {
  const { target, candidate } = documents();
  const dom = new JSDOM('<body><button id="exImport">Import project JSON…</button><div id="modal"></div></body>', {runScripts:'outside-only', url:'https://example.test/'});
  const w = dom.window, document = w.document, picks = [], notices = [], writes = [];
  const state = C.clone(target); state.cur = 0;
  const assets = new Map(owns.map(id => [id, {id, name:id}]));
  assets.set('owned-forest', {id:'owned-forest',name:'Forest.webp'});
  assets.set('owned-lake', {id:'owned-lake',name:'Lake.webp'});
  Object.assign(w, {
    A_RE:C.A_RE, clone:C.clone, migrate:C.migrate, mediaReferences:C.mediaReferences, state,
    doc:() => ({meta:state.meta,header:state.header,footer:state.footer,pages:state.pages}),
    SRV:{version:1}, AS:{mem:assets}, flushDraft:async()=>{}, selSet:vi.fn(), render:vi.fn(), checkpoint:vi.fn(),
    toast:(message)=>notices.push(message), esc:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    $: selector=>document.querySelector(selector), $$:selector=>[...document.querySelectorAll(selector)],
    openModal:(title,body,footer)=>{document.querySelector('#modal').innerHTML=`<h2>${title}</h2>${body}${footer}`;},
    closeModal: callback=>{document.querySelector('#modal').innerHTML='';if(typeof callback==='function')callback();},
    mediaPicker:async()=>picks.shift() || null,
    __save:async()=>{writes.push(C.clone(w.doc()));if(saveThrows) throw new Error('unexpected');return save;}
  });
  const actualFeedback = w.eval(`(${installActionFeedback.toString()})('')`);
  w.feedback = () => ({ ...actualFeedback, notify:(message,options)=>{notices.push(message);return actualFeedback.notify(message,options);} });
  w.eval(`let saving=false,saveAgain=false,saveState='ok',dirty=false; async function writeNow(){if(await window.__save()){saveState='ok';dirty=false;}else{saveState='failed';dirty=true;}}\n${helpers}`);
  return {dom,w,document,state,target,candidate,picks,notices,writes,actualFeedback};
}

describe('Cloud project JSON media preflight', () => {
  test('invalid project files leave the target untouched', () => {
    const f = fixture(), before = JSON.stringify(f.w.doc());
    expect(f.w.parseProjectImport('{')).toBeNull();
    expect(f.w.parseProjectImport('{"pages":[]}')).toBeNull();
    expect(JSON.stringify(f.w.doc())).toBe(before);
    expect(f.writes).toHaveLength(0); f.dom.window.close();
  });
  test('keeps target untouched until all images are chosen and remaps every occurrence', async () => {
    const f = fixture(), before = JSON.stringify(f.w.doc()), original = JSON.stringify(f.candidate);
    await f.w.importCloudProject(f.candidate);
    expect(JSON.stringify(f.w.doc())).toBe(before);
    expect(f.document.querySelector('#importApply').disabled).toBe(true);
    expect(f.document.querySelector('#modal').textContent).toContain('Cabins / forest / Image');
    expect(f.document.querySelector('#modal').textContent).not.toContain('foreign-one');
    expect(f.document.querySelector('[data-import-image="0"]').getAttribute('aria-label')).toContain('Image 1: Cabins / forest / Image');
    expect(f.document.querySelector('[data-import-image="1"]').getAttribute('aria-label')).toContain('Image 2:');
    f.picks.push('owned-forest'); f.document.querySelector('[data-import-image="0"]').click(); await tick();
    expect(f.document.querySelector('#importApply').disabled).toBe(true);
    expect(JSON.stringify(f.w.doc())).toBe(before);
    f.document.querySelector('[data-import-image="0"]').click(); await tick();
    expect(f.document.querySelector('#modal').textContent).toContain('Forest.webp');
    expect(f.document.querySelector('#importApply').disabled).toBe(true);
    f.picks.push('owned-lake'); f.document.querySelector('[data-import-image="1"]').click(); await tick();
    expect(f.document.querySelector('#importApply').disabled).toBe(false);
    f.document.querySelector('#importApply').click(); await tick();
    const output = JSON.stringify(f.w.doc());
    expect(output).not.toContain('asset:foreign-');
    expect(output).toContain('asset:owned-lake@640');
    expect(output).toContain('asset:owned-lake@320');
    expect(output).toContain('asset:owned-forest');
    expect(f.writes).toHaveLength(1);
    expect(f.notices).toContain('Project imported and saved.');
    expect(JSON.stringify(f.candidate)).toBe(original);
    f.dom.window.close();
  });
  test('cancel preserves target without saving', async () => {
    const f=fixture(), before=JSON.stringify(f.w.doc()); await f.w.importCloudProject(f.candidate);
    f.document.querySelector('#importCancel').click(); await tick();
    expect(JSON.stringify(f.w.doc())).toBe(before); expect(f.writes).toHaveLength(0); f.dom.window.close();
  });
  test('a successful import clears the prior file error, but cancellation does not', async () => {
    const f=fixture();
    f.actualFeedback.begin(f.document.querySelector('#exImport'), 'Importing project…').error('That file is not a Pagecraft project this build can open');
    expect(f.actualFeedback.problems()).toHaveLength(1);
    await f.w.importCloudProject(f.candidate);
    f.document.querySelector('#importCancel').click();
    expect(f.actualFeedback.problems()).toHaveLength(1);
    await f.w.importCloudProject(f.candidate);
    f.picks.push('owned-forest'); f.document.querySelector('[data-import-image="0"]').click(); await tick();
    f.picks.push('owned-lake'); f.document.querySelector('[data-import-image="1"]').click(); await tick();
    f.document.querySelector('#importApply').click(); await tick();
    expect(f.writes).toHaveLength(1);
    expect(f.actualFeedback.problems()).toHaveLength(0);
    f.actualFeedback.destroy(); f.dom.window.close();
  });
  test('a selected image removed while choosing another requires a fresh choice', async () => {
    const f=fixture(), before=JSON.stringify(f.w.doc()); await f.w.importCloudProject(f.candidate);
    f.picks.push('owned-forest'); f.document.querySelector('[data-import-image="0"]').click(); await tick();
    f.w.AS.mem.delete('owned-forest');
    f.picks.push('owned-lake'); f.document.querySelector('[data-import-image="1"]').click(); await tick();
    expect(f.document.querySelector('#importApply').disabled).toBe(true);
    expect(f.document.querySelector('#modal').textContent).toContain('Image no longer available. Choose another.');
    expect(JSON.stringify(f.w.doc())).toBe(before); expect(f.writes).toHaveLength(0);
    f.w.AS.mem.set('owned-forest', {id:'owned-forest',name:'Forest.webp'});
    f.picks.push('owned-forest'); f.document.querySelector('[data-import-image="0"]').click(); await tick();
    expect(f.document.querySelector('#importApply').disabled).toBe(false);
    f.w.AS.mem.delete('owned-forest');
    f.document.querySelector('#importApply').click(); await tick();
    expect(f.document.querySelector('#importApply').disabled).toBe(true);
    expect(f.document.querySelector('#modal').textContent).toContain('Image no longer available. Choose another.');
    expect(JSON.stringify(f.w.doc())).toBe(before); expect(f.writes).toHaveLength(0);
    f.dom.window.close();
  });
  test('same-site images need no mapping', async () => {
    const f=fixture({owns:['foreign-one','foreign-two']}); await f.w.importCloudProject(f.candidate); await tick();
    expect(f.writes).toHaveLength(1); expect(f.notices).toContain('Project imported and saved.'); f.dom.window.close();
  });
  test('a changed target prevents import and a failed save never claims success', async () => {
    const f=fixture(); await f.w.importCloudProject(f.candidate);
    f.picks.push('owned-forest'); f.document.querySelector('[data-import-image="0"]').click(); await tick();
    f.picks.push('owned-lake'); f.document.querySelector('[data-import-image="1"]').click(); await tick();
    f.state.meta.name='Newer draft'; f.document.querySelector('#importApply').click(); await tick();
    expect(f.writes).toHaveLength(0); expect(f.state.meta.name).toBe('Newer draft'); f.dom.window.close();
    const rejected=fixture({owns:['foreign-one','foreign-two'],save:false}); await rejected.w.importCloudProject(rejected.candidate); await tick();
    expect(rejected.writes).toHaveLength(1); expect(rejected.notices).not.toContain('Project imported and saved.');
    expect(rejected.state.meta.name).toBe('Imported project'); rejected.dom.window.close();
  });
  test('a rejected save does not clear the earlier file error', async () => {
    const f=fixture({owns:['foreign-one','foreign-two'],save:false});
    f.actualFeedback.begin(f.document.querySelector('#exImport'), 'Importing project…').error('That file is not a Pagecraft project this build can open');
    await f.w.importCloudProject(f.candidate); await tick();
    expect(f.actualFeedback.problems()).toHaveLength(1);
    expect(f.notices).not.toContain('Project imported and saved.');
    f.actualFeedback.destroy(); f.dom.window.close();
  });
  test('unexpected save errors do not claim success or discard the candidate', async () => {
    const f=fixture({owns:['foreign-one','foreign-two'],saveThrows:true});
    await f.w.importCloudProject(f.candidate); await tick();
    expect(f.notices).toContain('The import could not be confirmed. Check the draft save status before continuing.');
    expect(f.notices).not.toContain('Project imported and saved.');
    expect(f.state.meta.name).toBe('Imported project'); f.dom.window.close();
  });
});
