import {test,expect,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createApp} from '../server/src/app.ts';
import {MemoryStore} from '../server/src/store.ts';
import {MemoryAuthStore,hashToken} from '../server/src/auth.ts';
import {componentGalleryPage,galleryBaselineName,GALLERY_SECTIONS} from '../server/src/component-gallery.ts';
const editor=await readFile('index.html','utf8');
async function fixture(enabled=true){const auth=new MemoryAuthStore(),store=new MemoryStore(),user=await auth.createUser('gallery@example.invalid','Gallery');await auth.putSession(hashToken('gallery-test'),user.id,Date.now()+60000);return createApp({store,auth,componentGallery:enabled,editorHtml:editor,editorHost:'admin.test'});}
const headers={host:'admin.test',cookie:'pc_session=gallery-test'};
test('gallery is opt-in, authenticated, editor-host-only and private',async()=>{
 const app=await fixture();
 expect((await (await fixture(false)).request('http://admin.test/internal/components',{headers})).status).toBe(404);
 expect((await app.request('http://admin.test/internal/components',{headers:{host:'admin.test'}})).status).toBe(302);
 expect((await app.request('http://site.test/internal/components',{headers:{...headers,host:'site.test'}})).status).toBe(404);
 const r=await app.request('http://admin.test/internal/components',{headers});expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('private, no-store');expect(r.headers.get('x-robots-tag')).toBe('noindex, nofollow');
});
test('baseline asset names are allowlisted; anonymous and wrong-host access fail',async()=>{
 for(const name of ['../manifest.json','cloud-fields-390.png','cloud-fields-1440.png/extra','%2e%2e%2fsecret'])expect(galleryBaselineName(name)).toBeNull();
 expect(galleryBaselineName('builder-dialogs-768.png')).toBe('builder-dialogs-768.png');
 const app=await fixture();expect((await app.request('http://admin.test/internal/components/baselines/cloud-fields-1440.png',{headers:{host:'admin.test'}})).status).toBe(404);
 expect((await app.request('http://admin.test/internal/components/baselines/manifest.json',{headers})).status).toBe(404);
});
test('all specimens use the current host cascade and contain no submitting forms',()=>{
 for(const host of ['cloud','builder'])for(const section of GALLERY_SECTIONS){const html=componentGalleryPage(editor,host,section),dom=new JSDOM(html),d=dom.window.document;
 expect(d.body.dataset.galleryHost).toBe(host);expect(d.body.dataset.gallerySection).toBe(section);expect(d.querySelectorAll('form[action]').length).toBe(0);expect(d.querySelector('#gallery-layout')).not.toBeNull();expect(d.querySelector(host==='cloud'?'#pc-workspace-styles':'#pc-ui-styles')).not.toBeNull();expect(html).not.toContain('api/sites');expect(d.querySelector('.gallery-footnote')?.textContent).toContain('Local sample');dom.window.close();}
 const d=new JSDOM(componentGalleryPage(editor,'<script>','bogus'));expect(d.window.document.body.dataset.galleryHost).toBe('cloud');expect(d.window.document.body.dataset.gallerySection).toBe('fields');d.window.close();
});
test('every family includes a real-component long-content or recovery fixture',()=>{
 for(const host of ['cloud','builder'])for(const section of GALLERY_SECTIONS){
  const dom=new JSDOM(componentGalleryPage(editor,host,section)),d=dom.window.document;
  const example=d.querySelector(`[data-gallery-edge-case="${section}"]`);
  expect(example).not.toBeNull();
  expect(example.querySelectorAll('form[action], [onclick], iframe').length).toBe(0);
  for(const label of example.querySelectorAll('label[for]'))expect(d.getElementById(label.htmlFor)).not.toBeNull();
  expect(example.querySelector('button,textarea,[role="alert"]')).not.toBeNull();
  dom.window.close();
 }
});
function interactive(section){return new JSDOM(componentGalleryPage(editor,'cloud',section),{url:'https://admin.test/internal/components',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){Object.defineProperty(w.document,'fonts',{value:{ready:Promise.resolve()}});w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};}});}
test('processing blocks duplicates and restores its label and state after failure or success',async()=>{
 const dom=interactive('actions');await Promise.resolve();const d=dom.window.document,button=d.querySelector('[data-start]'),compact=d.querySelector('[data-pc-pending-icon]');expect(compact.getAttribute('aria-label')).toBe('Removing image…');expect(compact.textContent).toBe('');button.click();button.click();expect(d.querySelectorAll('.pc-notification').length).toBe(1);expect(button.disabled).toBe(true);expect(button.getAttribute('aria-busy')).toBe('true');d.querySelector('[data-finish=error]').click();expect(button.disabled).toBe(false);expect(button.textContent).toBe('Start processing');expect(d.querySelector('[role=alert]')?.textContent).toContain('Try Start');button.click();d.querySelector('[data-finish=success]').click();expect(d.querySelector('[role=status]')?.textContent).toContain('Nothing was saved');dom.window.close();
});
test('dialog variants retain input state, empty footer and return focus',async()=>{
 const dom=interactive('dialogs');await Promise.resolve();const d=dom.window.document,opener=d.querySelector('[data-dialog=empty]'),dialog=d.querySelector('dialog');opener.click();expect(dialog.open).toBe(true);expect(dialog.querySelector('footer')?.childElementCount).toBe(0);(d.querySelector('#dialog-name')).value='Unsaved preview';d.querySelector('[data-close]').click();expect(dialog.open).toBe(false);expect(d.activeElement).toBe(opener);d.querySelector('[data-dialog=danger]').click();expect(dialog.querySelector('[data-dialog-save]')?.textContent).toBe('Delete sample');expect((d.querySelector('#dialog-name')).value).toBe('Unsaved preview');dom.window.close();
});
test('feedback has real status/alert semantics and retry clears only the error',async()=>{
 const dom=interactive('feedback');await Promise.resolve();const d=dom.window.document;d.querySelector('[data-notice=error]').click();expect(d.querySelector('.pc-notification [role=alert]')).not.toBeNull();d.querySelector('[data-notice=success]').click();expect(d.querySelector('.pc-notification [role=status]')).not.toBeNull();d.querySelector('[data-dismiss]').click();await vi.waitFor(()=>expect(d.querySelector('.pc-notification')).toBeNull());d.querySelector('[data-retry]').click();expect((d.querySelector('#refresh-error')).hidden).toBe(true);expect(d.querySelector('#previous-result')?.textContent).toContain('3 entries');dom.window.close();
});
