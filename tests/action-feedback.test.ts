// @vitest-environment jsdom
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { installActionFeedback } from '../shared/action-feedback.js';
beforeEach(()=>{ document.body.innerHTML='<button id="save"><svg aria-hidden="true"></svg>Save changes</button>';vi.useFakeTimers(); });
afterEach(()=>{window.__pcFeedback?.destroy();vi.useRealTimers();});
const button=()=>document.querySelector<HTMLButtonElement>('#save')!;
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
 vi.advanceTimersByTime(60000);expect(document.querySelector('[role=alert]')?.textContent).toBe('Connection lost. Try again.');
 const retry=feedback.begin(button(),'Saving collection…')!;
 expect(document.querySelectorAll('.pc-notification')).toHaveLength(1);
 retry.success('Collection saved.');expect(button().hasAttribute('aria-busy')).toBe(false);
 expect(document.querySelector('[data-tone=success]')?.textContent).toContain('Collection saved.');
 vi.advanceTimersByTime(5001);expect(document.querySelector('.pc-notification')).toBeNull();
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
test('untrusted messages are text and persistent failures have an accessible dismissal',()=>{
 const feedback=installActionFeedback();feedback.notify('<img src=x onerror=alert(1)>',{tone:'error'});
 expect(document.querySelector('.pc-notification-message img')).toBeNull();
 expect(document.querySelector('[role=alert]')?.textContent).toBe('<img src=x onerror=alert(1)>');
 document.querySelector<HTMLButtonElement>('[aria-label="Dismiss notification"]')!.click();
 expect(document.querySelector('.pc-notification')).toBeNull();
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

test('processing failures retain feedback, release the lock and let a retry replace the same notification',async()=>{
 const feedback=installActionFeedback(),options={key:'detect',button:button(),pending:'Reading image…',success:'Image dimensions detected.'};
 const error=new Error('Image unavailable');
 const result=await feedback.run(options,()=>{throw error;});
 expect(result).toEqual({status:'error',error,message:'Image unavailable Try again.'});
 expect(button().disabled).toBe(false);
 vi.advanceTimersByTime(60000);expect(document.querySelector('[role=alert]')).not.toBeNull();
 await feedback.run(options,()=>({w:1200,h:800}));
 expect(document.querySelectorAll('.pc-notification')).toHaveLength(1);
 expect(document.querySelector('[role=alert]')).toBeNull();
 expect(document.querySelector('[data-tone=success]')?.textContent).toContain('Image dimensions detected.');
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
