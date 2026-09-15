// @vitest-environment jsdom
import { test, expect, vi, afterEach } from 'vitest';
import { liveReviewPage } from '../src/live-review-page.ts';
import { reviewClient } from '../src/live-review-client.ts';
const row = {id:'pin-1',siteId:'site',page:'welcome.html',device:'desktop',x:.5,y:100,nodeId:'',nodeX:0,nodeY:0,author:{id:'a',name:'Reviewer'},body:'Check spacing',createdAt:new Date().toISOString(),done:false,replies:[]};
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
test('unsent reply survives polling after blur, and mobile pin selection reveals its thread',async()=>{
  let poll: (()=>void) | undefined;
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
  vi.spyOn(window,'setInterval').mockImplementation((fn:any)=>{poll=fn;return 1 as unknown as ReturnType<typeof window.setInterval>;});
  vi.stubGlobal('fetch',vi.fn(async (url:string)=>({ok:true,json:async()=>url.includes('/preview')?{channel:'test-channel',version:1,html:'<body>Site</body>'}:{version:1,pins:[row]}})));
  const scroll = vi.fn(); HTMLElement.prototype.scrollIntoView = scroll;
  const html=liveReviewPage({name:'QA',siteId:'site',base:'/review/test',person:'QA',owner:false,canResolve:true,links:[],pages:[{path:'welcome.html',name:'Welcome'},{path:'pricing.html',name:'Pricing'}],invitations:[]});
  document.body.innerHTML=new DOMParser().parseFromString(html,'text/html').body.innerHTML;
  reviewClient();
  await vi.waitFor(()=>expect(document.querySelector('.outline-feedback')).not.toBeNull());
  expect((document.getElementById('page-select') as HTMLSelectElement).value).toBe('welcome.html');
  expect(document.querySelectorAll('#site-outline details, #site-outline .outline-page')).toHaveLength(0);
  expect(document.getElementById('site-outline')?.textContent).toContain('#1');
  expect(document.getElementById('site-outline')?.textContent).not.toContain('Pricing');
  const focusMessage = vi.spyOn((document.getElementById('site-frame') as HTMLIFrameElement).contentWindow!, 'postMessage');
  (document.querySelector('.outline-feedback') as HTMLButtonElement).click();
  expect(focusMessage).toHaveBeenCalledWith(expect.objectContaining({focus:'pin-1'}), '*');
  const textarea=document.querySelector('[aria-label="Reply to comment"]') as HTMLTextAreaElement;
  textarea.value='Unsent developer reply'; textarea.dispatchEvent(new Event('input')); textarea.blur();
  poll!();
  await vi.waitFor(()=>expect((document.querySelector('[aria-label="Reply to comment"]') as HTMLTextAreaElement).value).toBe('Unsent developer reply'));
  // Switching filters rebuilds the thread too; its draft is keyed by pin identity.
  const filter=document.getElementById('status-filter') as HTMLSelectElement; filter.value='all';filter.dispatchEvent(new Event('change'));
  expect((document.querySelector('[aria-label="Reply to comment"]') as HTMLTextAreaElement).value).toBe('Unsent developer reply');
  vi.stubGlobal('innerWidth',390);
  const frame=document.getElementById('site-frame') as HTMLIFrameElement;
  window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,data:{reviewChannel:'test-channel',select:'pin-1'}}));
  expect(scroll).toHaveBeenCalledWith({block:'start'});
  expect(document.activeElement?.textContent).toContain('#1');
});
