import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error jsdom has no bundled declarations in this workspace.
import { JSDOM } from 'jsdom';
import { SITE_PREVIEWS_BOOT_SCRIPT, installSitePreviews } from '../shared/site-previews.js';
import { FileSitePreviewStore } from '../server/src/site-previews.ts';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const windows: JSDOM[]=[];
afterEach(()=>{windows.splice(0).forEach(d=>d.window.close()); vi.restoreAllMocks();});
function rig(cached='1:', version='1:', capture=vi.fn()) {
 const dom = new JSDOM(`<article data-site-card><div class="pc-site-name">QA</div><div data-preview-site="qa" data-preview-version="${version}" data-cached-preview-version="${cached}" data-preview-source="/draft?v=1"><img src="/cached"></div></article>`,{url:'https://staging.test/',runScripts:'outside-only',pretendToBeVisual:true});
 windows.push(dom); const w=dom.window as any;
 w.IntersectionObserver=class { constructor(public cb:Function){} observe(node:Element){this.cb([{target:node,isIntersecting:true}]);} disconnect(){} };
 Object.defineProperty(w.HTMLImageElement.prototype,'complete',{get:()=>false});
 const requests: string[]=[];
 w.fetch=vi.fn(async(url:string)=>{requests.push(url);return {ok:true,json:async()=>({previewVersion:version,cachedPreviewVersion:cached})};});
 w.AbortSignal.timeout=()=>new w.AbortController().signal;
 w.capture=capture; w.eval(`(${installSitePreviews.toString()})(capture)`);
 return {dom,w,requests,card:w.document.querySelector('[data-preview-site]')};
}
describe('dashboard image cache',()=>{
 it('boot script parses without importing application state',()=>{expect(()=>new Function(SITE_PREVIEWS_BOOT_SCRIPT)).not.toThrow();});
 it('renders matching cache without a page iframe, and unchanged focus checks do not regenerate it',async()=>{
  const {w,requests}=rig(); w.dispatchEvent(new w.Event('focus')); await new Promise(r=>setTimeout(r,5));
  expect(w.document.querySelectorAll('iframe')).toHaveLength(0);expect(w.capture).not.toHaveBeenCalled(); expect(requests).toEqual(['/api/sites/qa/publication']);
 });
 it('keeps the existing image while preparing the next version and removes failed renderers',async()=>{
  const {w,card}=rig('1:','2:');expect(card.querySelector('img')).not.toBeNull();
  const frame=w.document.querySelector('iframe');expect(frame).not.toBeNull();
  frame.dispatchEvent(new w.Event('load')); await new Promise(r=>setTimeout(r,5));
  expect(w.document.querySelector('iframe')).toBeNull();expect(card.querySelector('img')).not.toBeNull();
  expect(card.querySelector('button').hidden).toBe(false);expect(card.textContent).toContain('Preview unavailable');
 });
 it('shows a recoverable refresh failure without discarding a cached image',async()=>{
  const {w,card}=rig();w.fetch=vi.fn(async()=>{throw Error('offline');});
  w.dispatchEvent(new w.Event('focus'));await new Promise(r=>setTimeout(r,5));
  expect(card.textContent).toContain('freshness could not be checked'); expect(card.querySelector('img')).not.toBeNull();
 });
 it('rejects pixels from an older generation after a newer save is observed',async()=>{
  let release!: (value:string)=>void;
  const capture=vi.fn(()=>new Promise<string>(resolve=>{release=resolve;}));
  const {w,card}=rig('1:','2:',capture);
  const frame=w.document.querySelector('iframe');
  const saved = new JSDOM('<html data-dashboard-preview="ready" data-preview-version="2:"><body>Saved page</body></html>');windows.push(saved);
  Object.defineProperty(frame,'contentDocument',{value:saved.window.document});
  frame.dispatchEvent(new w.Event('load'));await new Promise(r=>setTimeout(r,5));
  expect(w.capture).toHaveBeenCalled();
  w.fetch=vi.fn(async()=>({ok:true,json:async()=>({previewVersion:'3:',draftVersion:3})}));
  w.dispatchEvent(new w.Event('focus'));await new Promise(r=>setTimeout(r,5));
  release('data:image/webp;base64,AAAA');await new Promise(r=>setTimeout(r,5));
  expect(card.dataset.previewVersion).toBe('3:');
  expect(w.fetch.mock.calls.some((call:any[])=>call[1]?.method==='POST')).toBe(false);
 });
 it('keeps one durable image per site across store instances',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pc-previews-'));
  try{const store=new FileSitePreviewStore(root);await store.put('../qa','1:',new Uint8Array([1,2]));await store.put('../qa','2:',new Uint8Array([3,4]));
   expect(await readdir(root)).toHaveLength(1); const fresh=new FileSitePreviewStore(root);expect((await fresh.get('../qa'))?.version).toBe('2:');
   expect(await fresh.get('unrelated')).toBeNull();await fresh.remove('../qa');expect(await readdir(root)).toHaveLength(0);
  }finally{await rm(root,{recursive:true,force:true});}
 });
});
