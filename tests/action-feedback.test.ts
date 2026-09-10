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
