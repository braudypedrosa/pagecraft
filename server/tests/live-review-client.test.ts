// @vitest-environment jsdom
import { test, expect, vi, afterEach } from 'vitest';
import { liveReviewPage } from '../src/live-review-page.ts';
import { reviewClient } from '../src/live-review-client.ts';
import { REVIEW_CSS } from '../src/live-review-styles.ts';
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

test('resolve action uses an accessible check icon and preserves focus across state refresh',async()=>{
  let done=false, releaseResolve: (()=>void) | undefined;
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
  vi.spyOn(window,'setInterval').mockImplementation(()=>1 as unknown as ReturnType<typeof window.setInterval>);
  const fetchMock=vi.fn(async (url:string,init?:RequestInit)=>{
    if(url.includes('/preview')) return {ok:true,json:async()=>({channel:'test-channel',version:1,html:'<body>Site</body>'})};
    if(url.endsWith('/resolve')) {
      expect(JSON.parse(String(init?.body))).toEqual({pinId:'pin-1',done:true});
      await new Promise<void>(resolve=>{releaseResolve=resolve;}); done=true;
      return {ok:true,json:async()=>({})};
    }
    return {ok:true,json:async()=>({version:1,pins:[{...row,done}]})};
  });
  vi.stubGlobal('fetch',fetchMock);
  const html=liveReviewPage({name:'QA',siteId:'site',base:'/review/test',person:'QA',owner:false,canResolve:true,links:[],pages:[{path:'welcome.html',name:'Welcome'}],invitations:[]});
  document.body.innerHTML=new DOMParser().parseFromString(html,'text/html').body.innerHTML;
  reviewClient();
  await vi.waitFor(()=>expect(document.querySelector('.outline-feedback')).not.toBeNull());
  const filter=document.getElementById('status-filter') as HTMLSelectElement; filter.value='all'; filter.dispatchEvent(new Event('change'));
  (document.querySelector('.outline-feedback') as HTMLButtonElement).click();
  const resolve=document.querySelector('[aria-label="Mark resolved"]') as HTMLButtonElement;
  expect(resolve.title).toBe('Mark resolved');
  expect(resolve.getAttribute('aria-pressed')).toBe('false');
  expect(resolve.closest('.thread-heading')?.querySelector('.thread-actions')).not.toBeNull();
  expect(resolve.querySelector('svg')?.getAttribute('width')).toBe('14');
  expect(resolve.querySelector('path')?.getAttribute('d')).toBe('M20 6L9 17l-5-5');
  resolve.click();
  expect(resolve.disabled).toBe(true);
  expect(resolve.getAttribute('aria-busy')).toBe('true');
  releaseResolve!();
  await vi.waitFor(()=>expect(document.querySelector('[aria-label="Reopen note"]')).not.toBeNull());
  const reopen=document.querySelector('[aria-label="Reopen note"]') as HTMLButtonElement;
  expect(reopen.title).toBe('Reopen note');
  expect(reopen.getAttribute('aria-pressed')).toBe('true');
  expect(reopen.getAttribute('aria-busy')).toBe('false');
  expect(reopen.disabled).toBe(false);
  expect(reopen.querySelector('path')?.getAttribute('d')).toBe('M20 6L9 17l-5-5');
  expect(document.activeElement).toBe(reopen);
});

test('owner removal is recoverable, guarded against duplicates and moves focus to the active filter when the row leaves view',async()=>{
  let removed=false, removeAttempts=0, releaseRemove: (()=>void) | undefined;
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
  vi.spyOn(window,'setInterval').mockImplementation(()=>1 as unknown as ReturnType<typeof window.setInterval>);
  const pin={...row,number:7,replies:[{id:'reply-1',author:{id:'b',name:'Owner'},body:'Keep this reply',createdAt:new Date().toISOString()}]};
  vi.stubGlobal('fetch',vi.fn(async (url:string)=>{
    if(url.includes('/preview')) return {ok:true,json:async()=>({channel:'test-channel',version:1,html:'<body>Site</body>'})};
    if(url.endsWith('/remove')) {
      removeAttempts++;
      if(removeAttempts===1) return {ok:false,json:async()=>({error:'Temporary failure'})};
      await new Promise<void>(resolve=>{releaseRemove=resolve;}); removed=true;
      return {ok:true,json:async()=>({})};
    }
    if(url.endsWith('/restore')) { removed=false; return {ok:true,json:async()=>({})}; }
    return {ok:true,json:async()=>({version:1,pins:[{...pin,...(removed?{removedAt:new Date().toISOString(),removedBy:{id:'owner',name:'Owner'}}:{})}]})};
  }));
  const html=liveReviewPage({name:'QA',siteId:'site',base:'/review/test',person:'Owner',owner:true,canResolve:true,links:[],pages:[{path:'welcome.html',name:'Welcome'}],invitations:[]});
  document.body.innerHTML=new DOMParser().parseFromString(html,'text/html').body.innerHTML;
  reviewClient();
  await vi.waitFor(()=>expect(document.querySelector('.outline-feedback')).not.toBeNull());
  (document.querySelector('.outline-feedback') as HTMLButtonElement).click();
  let remove=document.querySelector('[aria-label="Remove note"]') as HTMLButtonElement;
  expect(remove.title).toBe('Remove note');
  expect(remove.querySelector('svg')?.getAttribute('width')).toBe('14');
  expect(remove.querySelector('path')?.getAttribute('d')).toBe('M18 6L6 18M6 6l12 12');
  expect(document.querySelector('.thread-actions')?.children).toHaveLength(2);

  remove.click();
  await vi.waitFor(()=>expect(document.getElementById('feedback')?.textContent).toBe('Temporary failure'));
  remove=document.querySelector('[aria-label="Remove note"]') as HTMLButtonElement;
  expect(remove.disabled).toBe(false);
  expect(document.activeElement).toBe(remove);
  expect(document.querySelector('.thread-body')?.textContent).toBe('Check spacing');

  remove.click(); remove.click();
  expect(remove.disabled).toBe(true);
  expect(remove.getAttribute('aria-busy')).toBe('true');
  expect(removeAttempts).toBe(2);
  releaseRemove!();
  await vi.waitFor(()=>expect(document.querySelector('.outline-feedback')).toBeNull());
  expect(document.getElementById('site-feedback-count')?.textContent).toBe('0 comments');
  expect(document.activeElement).toBe(document.querySelector('[data-status="open"]'));

  (document.querySelector('[data-status="removed"]') as HTMLButtonElement).click();
  expect(document.getElementById('site-feedback-count')?.textContent).toBe('1 comment');
  expect(document.querySelector('.feedback-index')?.textContent).toBe('#7');
  (document.querySelector('.outline-feedback') as HTMLButtonElement).click();
  expect(document.querySelector('.thread-body')?.textContent).toBe('Check spacing');
  expect(document.querySelector('.reply-content')?.textContent).toContain('Keep this reply');
  expect(document.querySelector('[aria-label="Reply to comment"]')).toBeNull();
  const restore=document.querySelector('[aria-label="Restore note"]') as HTMLButtonElement;
  expect(restore.title).toBe('Restore note');
  restore.click();
  await vi.waitFor(()=>expect(document.querySelector('.outline-feedback')).toBeNull());
  expect(document.activeElement).toBe(document.querySelector('[data-status="removed"]'));
});

test('reviewers receive no owner or resolver actions even if a note is selected',async()=>{
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
  vi.spyOn(window,'setInterval').mockImplementation(()=>1 as unknown as ReturnType<typeof window.setInterval>);
  vi.stubGlobal('fetch',vi.fn(async (url:string)=>({ok:true,json:async()=>url.includes('/preview')?{channel:'test-channel',version:1,html:'<body>Site</body>'}:{version:1,pins:[row]}})));
  const html=liveReviewPage({name:'QA',siteId:'site',base:'/review/test',person:'Reviewer',owner:false,canResolve:false,links:[],pages:[{path:'welcome.html',name:'Welcome'}],invitations:[]});
  document.body.innerHTML=new DOMParser().parseFromString(html,'text/html').body.innerHTML;
  reviewClient();
  await vi.waitFor(()=>expect(document.querySelector('.outline-feedback')).not.toBeNull());
  (document.querySelector('.outline-feedback') as HTMLButtonElement).click();
  expect(document.querySelector('.thread-actions')).toBeNull();
  expect(document.querySelector('[data-status="removed"]')).toBeNull();
});

test('review actions use subtle fine-pointer chrome and preserve coarse touch targets',()=>{
  expect(REVIEW_CSS).toContain('.thread-actions{display:flex;align-items:center;gap:2px;margin-left:auto');
  expect(REVIEW_CSS).toContain('.thread-action{width:28px;height:28px;min-width:28px;min-height:28px;padding:0;border:0');
  expect(REVIEW_CSS).toContain('.thread-action svg{width:14px;height:14px}');
  expect(REVIEW_CSS).toContain('.thread-action.thread-resolve{--pc-focus-bg:#eef5e6;--pc-focus-text:#3f562d;background:transparent;border-color:transparent;color:var(--muted)}');
  expect(REVIEW_CSS).toContain('.thread-action.thread-remove{--pc-focus-bg:#faeee9;--pc-focus-text:#883b2e;background:transparent;border-color:transparent;color:var(--muted)}');
  expect(REVIEW_CSS).toContain('@media(pointer:coarse){.thread-action{width:44px;height:44px;min-width:44px;min-height:44px}');
  expect(REVIEW_CSS).toContain('.thread-action.thread-restore{width:auto;min-width:auto;padding-inline:8px}');

  const style=document.createElement('style'); style.textContent=REVIEW_CSS; document.head.append(style);
  const workspace=document.createElement('main'); workspace.className='review-workspace';
  workspace.innerHTML='<aside class="comments-panel"><div class="thread-actions"><button class="thread-action thread-resolve" data-resting>Resolve</button><button class="thread-action thread-remove" data-focus>Remove</button></div></aside>';
  document.body.append(workspace);
  const resting=getComputedStyle(workspace.querySelector('[data-resting]') as HTMLButtonElement);
  expect(resting.borderTopWidth).toBe('0px');
  expect(resting.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  const action=workspace.querySelector('[data-focus]') as HTMLButtonElement;
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}));
  action.focus();
  expect(document.activeElement).toBe(action);
  expect(action.matches(':focus-visible')).toBe(true);
  const focused=getComputedStyle(action);
  // JSDOM preserves the winning outline shorthand instead of resolving its
  // longhands. `none` here reproduces the shared-focus cascade regression.
  expect(focused.outline).toBe('2px solid currentcolor');
  expect(focused.outlineOffset).toBe('2px');
  expect(focused.borderTopWidth).toBe('0px');
  style.remove();
});
