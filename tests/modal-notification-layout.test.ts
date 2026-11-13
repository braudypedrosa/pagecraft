// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { installActionFeedback } from '../shared/action-feedback.js';
// @ts-expect-error The shared JavaScript stylesheet has no declaration module.
import { DIALOG_CSS } from '../shared/dialog-styles.js';

afterEach(()=>{window.__pcFeedback?.destroy();vi.restoreAllMocks();document.body.replaceChildren();document.querySelector('#dialog-layout')?.remove();});
const settle=async()=>{await Promise.resolve();await Promise.resolve();};

test('an existing notification yields to dialog choices and returns to viewport placement after nested dialogs close',async()=>{
 document.body.innerHTML='<button id="origin">Edit component</button><div hidden id="mask"><div role="dialog" aria-modal="true" class="pc-dialog" style="transform:translateY(0)"><div class="pc-dialog-body"><button id="new-property">New property from this value</button></div><footer class="pc-dialog-foot"><button>Cancel</button></footer></div></div>';
 const feedback=installActionFeedback();const result=feedback.notify('Component created.',{tone:'success',duration:0});
 const host=document.querySelector<HTMLElement>('#pc-notifications')!;
 expect(getComputedStyle(host).position).toBe('fixed');
 const mask=document.querySelector<HTMLElement>('#mask')!;mask.hidden=false;await settle();
 const dialog=mask.querySelector<HTMLElement>('[role=dialog]')!;
 expect(host.parentElement).toBe(dialog);
 expect(getComputedStyle(host).position).toBe('relative');
 expect(getComputedStyle(host).overflow).toBe('auto');expect(getComputedStyle(host).pointerEvents).toBe('auto');
 expect(host.hasAttribute('popover')).toBe(false);
 const choice=document.querySelector<HTMLButtonElement>('#new-property')!;const selected=vi.fn();choice.onclick=selected;choice.focus();choice.click();
 expect(selected).toHaveBeenCalledOnce();expect(document.activeElement).toBe(choice);
 const nested=document.createElement('dialog');nested.open=true;nested.innerHTML='<button>Confirm</button>';document.body.append(nested);await settle();
 expect(host.parentElement).toBe(nested);
 nested.remove();await settle();expect(host.parentElement).toBe(dialog);
 mask.hidden=true;await settle();expect(host.parentElement).toBe(document.body);
 expect(getComputedStyle(host).position).toBe('fixed');
 result.dismiss();expect(host.childElementCount).toBe(0);
});

test('a constrained dialog reserves a bounded scrolling notice region without replacing its body or footer',()=>{
 const css=document.createElement('style');css.id='dialog-layout';css.textContent=DIALOG_CSS;document.head.append(css);
 document.body.innerHTML='<dialog class="pc-dialog" open><form class="pc-dialog-form"><div class="pc-dialog-body"><button>Last setting</button></div><footer class="pc-dialog-foot"><button>Save</button></footer></form></dialog>';
 const dialog=document.querySelector('dialog')!,body=dialog.querySelector<HTMLElement>('.pc-dialog-body')!,foot=dialog.querySelector<HTMLElement>('.pc-dialog-foot')!;
 const feedback=installActionFeedback();feedback.notify('Working…',{tone:'progress',duration:0});feedback.notify('Details '.repeat(80),{tone:'error',duration:0});
 const host=dialog.querySelector<HTMLElement>('#pc-notifications')!;
 expect(host.previousElementSibling).toBe(dialog.querySelector('form'));
 expect(getComputedStyle(host).position).toBe('relative');
 expect(getComputedStyle(host).maxHeight.replace(/\s/g,'')).toBe('min(180px,30dvh)');
 expect(parseFloat(getComputedStyle(host).minHeight)).toBe(0);
 expect(getComputedStyle(body).overflow).toBe('auto');expect(parseFloat(getComputedStyle(body).minHeight)).toBe(0);
 expect(getComputedStyle(foot).flexShrink).toBe('0');
 expect(host.querySelector('[role=status]')?.textContent).toBe('Working…');expect(host.querySelector('[role=alert]')).not.toBeNull();
 const dismiss=host.querySelector<HTMLButtonElement>('[aria-label="Dismiss notification"]')!;dismiss.focus();expect(dialog.contains(document.activeElement)).toBe(true);dismiss.click();
 expect(host.querySelectorAll('.pc-notification')).toHaveLength(1);
 feedback.destroy();expect(document.querySelector('#pc-notifications')).toBeNull();expect(body.isConnected).toBe(true);expect(foot.isConnected).toBe(true);
});

test('moving a visible viewport popover into a dialog closes its top layer and restores it on exit',async()=>{
 const feedback=installActionFeedback();feedback.notify('Saved',{id:'saved',duration:0});
 const host=document.querySelector<HTMLElement>('#pc-notifications')!;
 let open=false;const originalMatches=host.matches.bind(host);
 const show=vi.fn(()=>{open=true;}),hide=vi.fn(()=>{open=false;});
 Object.defineProperty(host,'showPopover',{value:show});Object.defineProperty(host,'hidePopover',{value:hide});
 vi.spyOn(host,'matches').mockImplementation(selector=>selector===':popover-open'?open:originalMatches(selector));
 feedback.notify('Saved again',{id:'saved',duration:0});
 expect(show).toHaveBeenCalledOnce();expect(host.getAttribute('popover')).toBe('manual');
 const dialog=document.createElement('dialog');dialog.open=true;dialog.innerHTML='<button>Continue</button>';document.body.append(dialog);await settle();
 expect(hide).toHaveBeenCalledOnce();expect(open).toBe(false);expect(host.hasAttribute('popover')).toBe(false);
 expect(getComputedStyle(host).position).toBe('relative');
 dialog.remove();await settle();expect(show.mock.calls.length).toBeGreaterThanOrEqual(2);expect(open).toBe(true);expect(host.getAttribute('popover')).toBe('manual');
});
