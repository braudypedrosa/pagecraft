// @vitest-environment jsdom
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { installActionFeedback } from '../shared/action-feedback.js';
const originalWidth=Object.getOwnPropertyDescriptor(window,'innerWidth')!;
const originalHeight=Object.getOwnPropertyDescriptor(window,'innerHeight')!;
beforeEach(()=>{ document.body.innerHTML='<button id="save"><svg aria-hidden="true"></svg>Save changes</button>';vi.useFakeTimers(); });
afterEach(()=>{window.__pcFeedback?.destroy();vi.restoreAllMocks();vi.useRealTimers();Object.defineProperty(window,'innerWidth',originalWidth);Object.defineProperty(window,'innerHeight',originalHeight);});
const button=()=>document.querySelector<HTMLButtonElement>('#save')!;
test('editor notices fit inside the available canvas and clear its zoom controls after resize',()=>{
 document.body.insertAdjacentHTML('beforeend','<main id="stage"><div id="dim"></div></main>');
 const stage=document.querySelector<HTMLElement>('#stage')!,dim=document.querySelector<HTMLElement>('#dim')!;
 let bounds={x:88,y:52,left:88,top:52,right:468,bottom:1024,width:380,height:972,toJSON:()=>({})};
 vi.spyOn(stage,'getBoundingClientRect').mockImplementation(()=>bounds);
 vi.spyOn(dim,'getBoundingClientRect').mockReturnValue({x:88,y:970,left:88,top:970,right:468,bottom:1010,width:380,height:40,toJSON:()=>({})});
 Object.defineProperty(window,'innerWidth',{configurable:true,value:768});
 Object.defineProperty(window,'innerHeight',{configurable:true,value:1024});
 const feedback=installActionFeedback();
 feedback.notify('Style updated everywhere',{tone:'success'});
 const notices=document.querySelector<HTMLElement>('#pc-notifications')!;
 expect(parseFloat(notices.style.right)).toBe(316);
 expect(parseFloat(notices.style.width)).toBe(348);
 expect(parseFloat(notices.style.bottom)).toBe(66);
 expect(768-parseFloat(notices.style.right)).toBeLessThan(bounds.right);
 bounds={...bounds,width:332,right:420};
 Object.defineProperty(window,'innerWidth',{configurable:true,value:720});
 window.dispatchEvent(new Event('resize'));
 expect(parseFloat(notices.style.width)).toBe(300);
 expect(720-parseFloat(notices.style.right)).toBeLessThan(bounds.right);
 bounds={...bounds,width:0,height:0};
 window.dispatchEvent(new Event('resize'));
 expect(notices.style.right).toBe('');
 expect(notices.style.width).toBe('');
});
test('pending actions prevent duplicate requests and restore the original icon and accessible name on failure',()=>{
 const feedback=installActionFeedback(), original=button().innerHTML;
 button().setAttribute('aria-label','Save this collection');
 const action=feedback.begin(button(),'Saving collection…')!;
 expect(feedback.begin(button(),'Saving twice')).toBeNull();
 expect(button().disabled).toBe(true);expect(button().getAttribute('aria-busy')).toBe('true');
 expect(document.querySelector('[role=status]')?.textContent).toBe('Saving collection…');
 vi.advanceTimersByTime(30000);expect(document.querySelector('[data-tone=progress]')).not.toBeNull();
 action.error('Connection lost. Try again.');
 expect(button().disabled).toBe(false);expect(button().innerHTML).toBe(original);
 expect(button().getAttribute('aria-label')).toBe('Save this collection');
 vi.advanceTimersByTime(5001);expect(document.querySelector('[role=alert]')).toBeNull();
 const retry=feedback.begin(button(),'Saving collection…')!;
 expect(document.querySelectorAll('.pc-notification')).toHaveLength(1);
 retry.success('Collection saved.');expect(button().hasAttribute('aria-busy')).toBe(false);
 expect(document.querySelector('[data-tone=success]')?.textContent).toContain('Collection saved.');
 vi.advanceTimersByTime(5001);expect(document.querySelector('.pc-notification')).toBeNull();
});
test('icon-only actions keep their compact box and expose pending copy accessibly',()=>{
 document.body.insertAdjacentHTML('beforeend','<button id="remove" class="mdel" aria-label="Delete image"><svg aria-hidden="true"></svg></button>');
 const remove=document.querySelector<HTMLButtonElement>('#remove')!,original=remove.innerHTML;
 const action=installActionFeedback().begin(remove,'Deleting image…')!;
 expect(remove.textContent).toBe('');
 expect(remove.hasAttribute('data-pc-pending-icon')).toBe(true);
 expect(remove.getAttribute('aria-label')).toBe('Deleting image…');
 action.error('The image is still in use.');
 expect(remove.innerHTML).toBe(original);
 expect(remove.hasAttribute('data-pc-pending-icon')).toBe(false);
 expect(remove.getAttribute('aria-label')).toBe('Delete image');
});
test.each([
 ['Cloud icon primitive','pc-iconbtn','<svg aria-hidden="true"></svg>',''],
 ['explicit icon contract','','<span aria-hidden="true">×</span>','data-icon-only'],
 ['screen-reader-labelled icon','','<svg aria-hidden="true"></svg><span class="sr-only">Remove</span>',''],
])('%s uses the contained icon pending state',(_name,className,content,attribute)=>{
 document.body.insertAdjacentHTML('beforeend',`<button id="compact" class="${className}" aria-label="Remove" ${attribute}>${content}</button>`);
 const compact=document.querySelector<HTMLButtonElement>('#compact')!;
 const action=installActionFeedback().begin(compact,'Removing…')!;
 expect(compact.hasAttribute('data-pc-pending-icon')).toBe(true);
 expect(compact.textContent).toBe('');
 action.cancel();
});
test('confirmation timers pause for reading and keyboard interaction',()=>{
 const feedback=installActionFeedback();feedback.notify('Image uploaded.',{tone:'success'});
 const node=document.querySelector('.pc-notification')!;
 vi.advanceTimersByTime(2000);node.dispatchEvent(new MouseEvent('mouseenter'));
 vi.advanceTimersByTime(9000);expect(node.isConnected).toBe(true);
 node.dispatchEvent(new MouseEvent('mouseleave'));vi.advanceTimersByTime(3001);
 expect(node.isConnected).toBe(false);
});
test('notifications stay in the active dialog and survive its closure without stealing focus',async()=>{
 const dialog=document.createElement('dialog');dialog.setAttribute('open','');dialog.innerHTML='<button id="dialog-save">Save</button>';document.body.append(dialog);
 const trigger=dialog.querySelector<HTMLButtonElement>('button')!;trigger.focus();
 const feedback=installActionFeedback();feedback.notify('Saved',{tone:'success'});
 expect(dialog.querySelector('#pc-notifications')).not.toBeNull();expect(document.activeElement).toBe(trigger);
 dialog.removeAttribute('open');await Promise.resolve();
 expect(document.querySelector('#pc-notifications')?.parentElement).toBe(document.body);
});
test('untrusted messages are text and failures retain an accessible manual dismissal',()=>{
 const feedback=installActionFeedback();feedback.notify('<img src=x onerror=alert(1)>',{tone:'error'});
 expect(document.querySelector('.pc-notification-message img')).toBeNull();
 expect(document.querySelector('[role=alert]')?.textContent).toBe('<img src=x onerror=alert(1)>');
 document.querySelector<HTMLButtonElement>('[aria-label="Dismiss notification"]')!.click();
 expect(document.querySelector('.pc-notification')).toBeNull();
});

test('failure guidance survives timed and manual notification dismissal without browser storage',()=>{
 const feedback=installActionFeedback();
 feedback.notify('The image could not be uploaded. Try uploading it again.',{tone:'error',id:'upload'});
 vi.advanceTimersByTime(5001);
 expect(document.querySelector('.pc-notification')).toBeNull();
 expect(feedback.problems()).toEqual([expect.objectContaining({id:'upload',message:'The image could not be uploaded. Try uploading it again.'})]);
 feedback.notify('<img src=x onerror=alert(1)>',{tone:'error',id:'untrusted'});
 document.querySelector<HTMLButtonElement>('[aria-label="Dismiss notification"]')!.click();
 expect(feedback.problems().map(problem=>problem.id)).toEqual(['untrusted','upload']);
 feedback.resolveProblem('untrusted');
 expect(feedback.problems().map(problem=>problem.id)).toEqual(['upload']);
});

test('retrying the same action retains its failure until the retry succeeds',()=>{
 const feedback=installActionFeedback();
 feedback.begin(button(),'Saving…','save')!.error('Connection lost. Try again.');
 expect(feedback.problems()).toHaveLength(1);
 const retry=feedback.begin(button(),'Saving…','save')!;
 expect(feedback.problems()).toHaveLength(1);
 retry.cancel();
 expect(feedback.problems()).toHaveLength(1);
 feedback.begin(button(),'Saving…','save')!.success('Saved.');
 expect(feedback.problems()).toHaveLength(0);
});

test('a replaced control with the same DOM id clears the logical action failure on success',()=>{
 const feedback=installActionFeedback();
 feedback.begin(button(),'Publishing…')!.error('Publishing failed. Try again.');
 const first=feedback.problems()[0];
 expect(first).toMatchObject({id:'button-id-save',canRecover:true});

 button().outerHTML='<button id="save">Publish</button>';
 expect(feedback.problems()[0]).toMatchObject({id:'button-id-save',canRecover:false});
 feedback.begin(button(),'Publishing…')!.success('Published.');
 expect(feedback.problems()).toEqual([]);
});

test('a replaced control cannot restart its logical action until the pending attempt ends',()=>{
 const feedback=installActionFeedback();
 const first=feedback.begin(button(),'Publishing…')!;
 button().outerHTML='<button id="save">Publish</button>';

 expect(feedback.begin(button(),'Publishing twice…')).toBeNull();
 expect(button().disabled).toBe(false);
 first.cancel();

 const retry=feedback.begin(button(),'Publishing again…');
 expect(retry).not.toBeNull();
 expect(button().disabled).toBe(true);
 retry!.cancel();
 expect(button().disabled).toBe(false);
});

test('pending anonymous and no-control actions remain independent',()=>{
 document.body.insertAdjacentHTML('beforeend','<button class="anonymous">First</button><button class="anonymous">Second</button>');
 const controls=[...document.querySelectorAll<HTMLButtonElement>('.anonymous')];
 const feedback=installActionFeedback();
 const first=feedback.begin(controls[0],'Trying first…')!;
 const second=feedback.begin(controls[1],'Trying second…')!;
 const backgroundA=feedback.begin(null,'Background A…')!;
 const backgroundB=feedback.begin(null,'Background B…')!;

 expect(first).toBeTruthy();
 expect(second).toBeTruthy();
 expect(backgroundA).toBeTruthy();
 expect(backgroundB).toBeTruthy();
 first.cancel();second.cancel();backgroundA.cancel();backgroundB.cancel();
});

test('anonymous controls keep independent action failures',()=>{
 document.body.insertAdjacentHTML('beforeend','<button class="anonymous">Retry</button><button class="anonymous">Retry</button>');
 const controls=[...document.querySelectorAll<HTMLButtonElement>('.anonymous')];
 const feedback=installActionFeedback();
 feedback.begin(controls[0],'Trying…')!.error('First failed.');
 feedback.begin(controls[1],'Trying…')!.error('Second failed.');
 const problems=feedback.problems();
 expect(problems).toHaveLength(2);
 expect(new Set(problems.map(problem=>problem.id)).size).toBe(2);

 feedback.begin(controls[0],'Trying…')!.success('First succeeded.');
 expect(feedback.problems()).toEqual([expect.objectContaining({message:'Second failed.'})]);
});

test('return-to-action availability follows the original control and never automatically retries',()=>{
 const feedback=installActionFeedback(),clicked=vi.fn();
 button().addEventListener('click',clicked);
 feedback.begin(button(),'Saving…')!.error('Try again.');
 const id=feedback.problems()[0].id;
 expect(feedback.problems()[0].canRecover).toBe(true);
 expect(feedback.recoverProblem(id)).toBe(true);
 expect(document.activeElement).toBe(button());
 expect(clicked).not.toHaveBeenCalled();
 button().remove();
 expect(feedback.problems()[0].canRecover).toBe(false);
 expect(feedback.recoverProblem(id)).toBe(false);
});

test('silent recovery messages are deduplicated, bounded, and cleared on destroy',()=>{
 const feedback=installActionFeedback(),recover=vi.fn();
 feedback.rememberProblem('Keep this draft open.',{id:'draft',label:'Save draft',recover});
 feedback.rememberProblem('Download a backup before reloading.',{id:'draft',label:'Save draft',recover});
 expect(document.querySelector('.pc-notification')).toBeNull();
 expect(feedback.problems()).toHaveLength(1);
 feedback.recoverProblem('draft');expect(recover).toHaveBeenCalledTimes(1);
 for(let i=0;i<25;i++)feedback.rememberProblem('Problem '+i,{id:'problem-'+i});
 expect(feedback.problems()).toHaveLength(20);
 const snapshot=feedback.problems();snapshot[0].message='Changed externally';
 expect(feedback.problems()[0].message).not.toBe('Changed externally');
 feedback.destroy();expect(feedback.problems()).toEqual([]);
});

test('builder custom dialogs keep notifications within their focus trap',async()=>{
 const mask=document.createElement('div');mask.innerHTML='<div role="dialog" aria-modal="true"><button>Close</button></div>';document.body.append(mask);
 installActionFeedback().notify('Export ready.',{tone:'success'});
 expect(mask.querySelector('#pc-notifications')).not.toBeNull();mask.hidden=true;await Promise.resolve();
 expect(document.querySelector('#pc-notifications')?.parentElement).toBe(document.body);
});

test('one processing job owns its result and blocks duplicates even when its button is replaced', async()=>{
 const feedback=installActionFeedback();
 let resolve!:(value:number)=>void;
 const work=vi.fn(()=>new Promise<number>(yes=>{resolve=yes;}));
 const options={key:'export',button:button(),pending:'Building archive…',success:(count:number)=>`${count} files ready.`};
 const job=feedback.run(options,work);
 button().outerHTML='<button id="save">New export button</button>';
 expect(await feedback.run({...options,button:button()},work)).toEqual({status:'busy'});
 expect(work).toHaveBeenCalledTimes(1);
 expect(document.querySelector('[data-tone=success]')).toBeNull();
 resolve(12);expect(await job).toEqual({status:'success',value:12});
 expect(document.querySelector('[role=status]')?.textContent).toBe('12 files ready.');
 expect(await feedback.run({...options,button:button()},()=>false)).toEqual({status:'cancelled'});
 expect(button().disabled).toBe(false);expect(document.querySelector('.pc-notification')).toBeNull();
});

test('processing failures auto-dismiss, release the lock and still allow a retry',async()=>{
 const feedback=installActionFeedback(),options={key:'detect',button:button(),pending:'Reading image…',success:'Image dimensions detected.'};
 const error=new Error('Image unavailable');
 const result=await feedback.run(options,()=>{throw error;});
 expect(result).toEqual({status:'error',error,message:'Image unavailable Try again.'});
 expect(button().disabled).toBe(false);
 vi.advanceTimersByTime(5001);expect(document.querySelector('[role=alert]')).toBeNull();
 await feedback.run(options,()=>({w:1200,h:800}));
 expect(document.querySelectorAll('.pc-notification')).toHaveLength(1);
 expect(document.querySelector('[role=alert]')).toBeNull();
 expect(document.querySelector('[data-tone=success]')?.textContent).toContain('Image dimensions detected.');
});
test('announce false keeps the action lock but leaves result announcements to the caller',async()=>{
 const feedback=installActionFeedback(),options=Object.assign(
   {key:'cms-save',button:button(),pending:'Saving entry…',success:'Entry saved.'},
   {announce:false},
 );
 const job=feedback.run(options,async()=>{await Promise.resolve();return true;});
 expect(button().disabled).toBe(true);
 expect(document.querySelector('#pc-notifications')).toBeNull();
 expect(await job).toEqual({status:'success',value:true});
 expect(button().disabled).toBe(false);
 expect(document.querySelector('#pc-notifications')).toBeNull();
});

test('progress and explicitly persistent notices remain until resolved or dismissed',()=>{
 const feedback=installActionFeedback();
 feedback.notify('Uploading…',{tone:'progress'});
 feedback.notify('Reconnect your account.',{tone:'error',duration:0});
 vi.advanceTimersByTime(60000);
 expect(document.querySelector('[data-tone=progress]')?.textContent).toContain('Uploading…');
 expect(document.querySelector('[role=alert]')?.textContent).toContain('Reconnect your account.');
});

test('independent actions can run together and cancelling one never restores another action early',async()=>{
 const feedback=installActionFeedback();
 let finish!:()=>void;
 const first=feedback.run({key:'upload',pending:'Uploading…',success:'Uploaded.'},()=>new Promise<void>(yes=>{finish=yes;}));
 const cancelled=await feedback.run({button:button(),pending:'Choosing a file…',success:'File saved.'},()=>{throw new DOMException('Cancelled','AbortError');});
 expect(cancelled.status).toBe('cancelled');expect(button().disabled).toBe(false);
 expect(document.querySelector('[role=status]')?.textContent).toBe('Uploading…');
 finish();await first;
 expect(document.querySelector('[role=status]')?.textContent).toBe('Uploaded.');
});

test('CPU work can yield a frame while user-activation work starts synchronously',async()=>{
 const feedback=installActionFeedback();
 const clipboard=vi.fn(()=>undefined);
 const copy=feedback.run({pending:'Copying…',success:'Copied.'},clipboard);
 expect(clipboard).toHaveBeenCalledTimes(1);await copy;
 const build=vi.fn(()=>12);
 const job=feedback.run({pending:'Building…',success:'Built.',paint:true},build);
 expect(build).not.toHaveBeenCalled();
 await vi.advanceTimersByTimeAsync(101);await job;
 expect(build).toHaveBeenCalledTimes(1);
});
