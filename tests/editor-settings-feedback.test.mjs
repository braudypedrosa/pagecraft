import {afterEach, expect, test, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {JSDOM, VirtualConsole} from 'jsdom';
import * as C from '../app/src/core/index';
const windows=[];
afterEach(()=>{for(const dom of windows.splice(0))dom.window.close()});
async function cloud(){
 C.blankProject('Local test document');
 const config={siteId:'qa',name:'Cloud QA',version:1,editorSessionToken:'qa-session',role:'owner',doc:JSON.parse(JSON.stringify(C.doc())),user:{id:'qa',email:'qa@example.invalid',name:'QA'}};
 const marker='<script>\n/* =====================================================================';
 const source=readFileSync('index.html','utf8').replace(marker,`<script>window.PC_SERVER=${JSON.stringify(config)}</script>\n${marker}`);
 const calls=[];let rejectRename=false, holdSave=false, releaseSave;
 const errors=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(source,{url:'https://example.test/edit/qa',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.fetch=async(url,options={})=>{
   calls.push({url:String(url),method:options.method||'GET',body:options.body});
   if(options.method==='PUT' && holdSave)await new Promise(resolve=>{releaseSave=resolve});
   if(String(url).endsWith('/settings/name')) {
    if(rejectRename)throw new Error('Rename unavailable. Try again.');
    return {ok:true,status:200,url:'https://example.test/sites/qa/settings',text:async()=>'<p class="notice" role="status">Site name updated.</p>'};
   }
   return {ok:true,status:200,json:async()=>String(url).endsWith('/assets')?[]:{version:2}};
  };
 }});
 windows.push(dom);
 await new Promise(r=>setTimeout(r,800));
 expect(errors).toEqual([]);
 if(dom.window.document.querySelector('#savedTag').textContent==='—')dom.window.bindTop();
 dom.window.renderModebar();
 return {w:dom.window,d:dom.window.document,calls,failRename:()=>{rejectRename=true},holdSave:()=>{holdSave=true},releaseSave:()=>releaseSave()};
}
test('Cloud settings Close is quiet when unchanged, but preserves pending names and errors',async()=>{
 const {w,d,calls,failRename}=await cloud();
 w.projectModal();
 d.querySelector('#mDone').click();
 await vi.waitFor(()=>expect(d.querySelector('#modal').hidden).toBe(true));
 expect(calls.filter(c=>c.method!=='GET')).toHaveLength(0);
 expect(d.querySelector('.pc-notification')).toBeNull();
 w.projectModal();d.querySelector('#mName').value='Renamed Cloud QA';d.querySelector('#mDone').click();
 await vi.waitFor(()=>expect(d.querySelector('#modal').hidden).toBe(true));
 expect(calls.filter(c=>c.method==='POST')).toHaveLength(1);
 expect(d.querySelector('#docName').textContent).toContain('Renamed Cloud QA');
 expect(d.querySelector('.pc-notification[data-tone="success"]')?.textContent).toContain('Changes saved.');
 w.projectModal();d.querySelector('#mName').value='Keep this unsaved name';failRename();d.querySelector('#mDone').click();
 await vi.waitFor(()=>expect(d.querySelector('.pc-notification[data-tone="error"]')?.textContent).toContain('Rename unavailable'));
 expect(d.querySelector('#modal').hidden).toBe(false);
 expect(d.querySelector('#mName').value).toBe('Keep this unsaved name');
 expect(d.querySelector('#mDone').disabled).toBe(false);
});
test('Cloud help accurately describes private drafts and supported export shortcut',async()=>{
 const {w,d}=await cloud();w.helpModal();
 expect(d.querySelector('#mBody').textContent).toContain('autosaved to your Pagecraft site draft');
 expect(d.querySelector('#mBody').textContent).not.toContain('stored in this browser');
 expect(d.querySelector('#mBody').textContent).toContain('Export static HTML');
 d.querySelector('#hOk').click();
 w.exportModal();expect(d.querySelector('#mTitle').textContent).toBe('Export static HTML');
});

test('Close waits for an unsaved document and prevents duplicate processing',async()=>{
 const {w,d,calls,holdSave,releaseSave}=await cloud();
 w.projectModal();
 const input=d.querySelector('#mBase');
 input.value='https://qa.example.invalid';input.dispatchEvent(new w.Event('input',{bubbles:true}));
 holdSave();d.querySelector('#mDone').click();d.querySelector('#mDone').click();
 await vi.waitFor(()=>expect(calls.filter(c=>c.method==='PUT')).toHaveLength(1));
 expect(d.querySelector('#modal').hidden).toBe(false);
 expect(d.querySelector('#mDone').disabled).toBe(true);
 expect(input.value).toBe('https://qa.example.invalid');
 releaseSave();
 await vi.waitFor(()=>expect(d.querySelector('#modal').hidden).toBe(true));
 expect(JSON.parse(calls.find(c=>c.method==='PUT').body).doc.meta.baseUrl).toBe('https://qa.example.invalid');
});
