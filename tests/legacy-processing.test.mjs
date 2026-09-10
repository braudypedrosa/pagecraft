import { afterEach, test, expect, vi } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createApp, SESSION_COOKIE } from '../server/src/app';
import { MemoryStore } from '../server/src/store';
import { MemoryAuthStore, hashToken } from '../server/src/auth';
const windows=[];
afterEach(()=>{for(const dom of windows.splice(0)){dom.window.__pcFeedback?.destroy();dom.window.close();}});
async function setup(signedIn=false){
 const auth=new MemoryAuthStore(),store=new MemoryStore();
 if(signedIn){const user=await auth.createUser('qa@example.invalid','QA');await auth.putSession(hashToken('local-test'),user.id,Date.now()+60000);}
 const app=createApp({store,auth,editorHost:'app.test',editorOrigin:'http://app.test',editorHtml:'Builder'});
 const response=await app.request(new Request('http://app.test/',{headers:{host:'app.test',...(signedIn?{cookie:`${SESSION_COOKIE}=local-test`}:{})}}));
 expect(response.status).toBe(200);
 const dom=new JSDOM(await response.text(),{url:'http://app.test/',runScripts:'dangerously',virtualConsole:new VirtualConsole()});windows.push(dom);
 const w=dom.window,form=w.document.querySelector('form'),button=form.querySelector('button');
 const submit=()=>form.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:button}));
 return {w,form,button,submit};
}
test('legacy sign-in uses real server markup with pending, error recovery and an acknowledged result',async()=>{
 const {w,form,button,submit}=await setup();
 form.querySelector('input').value='qa@example.invalid';
 let fail;w.fetch=vi.fn(()=>new Promise((_,reject)=>{fail=reject;}));
 submit();submit();expect(w.fetch).toHaveBeenCalledTimes(1);
 expect(button.getAttribute('aria-busy')).toBe('true');
 expect(w.document.querySelector('[data-tone=progress]').textContent).toContain('Sending sign-in link');
 fail(new Error('Mail temporarily unavailable.'));
 await vi.waitFor(()=>expect(button.disabled).toBe(false));
 expect(w.document.querySelector('#err').hidden).toBe(false);
 expect(form.querySelector('input').value).toBe('qa@example.invalid');
 w.fetch=vi.fn(async()=>({ok:true,json:async()=>({})}));submit();
 await vi.waitFor(()=>expect(form.hidden).toBe(true));
 expect(w.document.querySelector('[data-tone=success]').textContent).toContain('Sign-in link sent');
});
test('legacy new-site network failure unlocks the action, retains the name and warns before retrying an uncertain creation',async()=>{
 const {w,form,button,submit}=await setup(true);
 form.querySelector('input').value='QA retained site';
 w.fetch=vi.fn(async()=>{throw new TypeError('Failed to fetch');});
 submit();submit();expect(w.fetch).toHaveBeenCalledTimes(1);
 await vi.waitFor(()=>expect(button.disabled).toBe(false));
 expect(form.querySelector('input').value).toBe('QA retained site');
 expect(w.document.querySelector('[data-tone=error]').textContent).toContain('Check Sites before trying again');
 expect(w.document.querySelector('[data-tone=success]')).toBeNull();
 expect(button.textContent).toBe('Create it');
});
