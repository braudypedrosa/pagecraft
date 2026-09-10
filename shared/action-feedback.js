/** Action feedback shared by the portable builder and Cloud management pages.
 * Explicit actions announce their actual result; autosave keeps its own quiet status.
 */
export const ACTION_FEEDBACK_CSS = `
.pc-notifications{position:fixed;inset:auto 20px 20px auto;z-index:20000;display:flex;flex-direction:column;gap:10px;width:min(420px,calc(100vw - 32px));max-height:calc(100dvh - 40px);overflow:auto;pointer-events:none;margin:0;padding:0;border:0;background:transparent;color:#f5f7f8;font:500 13px/1.5 Manrope,system-ui,sans-serif}
.pc-notifications:empty{display:none}.pc-notification{display:flex;align-items:flex-start;gap:10px;padding:14px 12px 14px 16px;background:#171a17;border-radius:8px;box-shadow:0 10px 28px -10px #0006;pointer-events:auto;overflow-wrap:anywhere}.pc-notification[data-tone="error"]{background:#752922}.pc-notification-icon{width:18px;height:18px;flex:0 0 18px;margin-top:1px}.pc-notification[data-tone="success"] .pc-notification-icon{color:#b7f34a}.pc-notification-message{flex:1;min-width:0}.pc-notification button{display:grid!important;place-items:center!important;flex:0 0 28px!important;width:28px!important;min-height:28px!important;height:28px!important;padding:5px!important;margin:-3px 0 -3px 2px!important;border:0!important;border-radius:4px!important;background:transparent!important;color:inherit!important;cursor:pointer!important;opacity:1!important}.pc-notification button:hover{background:#ffffff1c!important}.pc-notification button:focus-visible{outline:2px solid #b7f34a!important;outline-offset:1px!important}.pc-notification button svg{width:16px;height:16px}.pc-notification[data-tone="progress"] .pc-notification-icon,[data-pc-pending]::before{animation:pc-action-spin .8s linear infinite}[data-pc-pending]{cursor:progress!important;opacity:.85!important}[data-pc-pending]::before{content:"";display:inline-block;width:13px;height:13px;flex:0 0 13px;box-sizing:border-box;border:1.5px solid currentColor;border-right-color:transparent;border-radius:50%;vertical-align:middle;margin-inline-end:6px}.pc-action-status{display:flex;align-items:center;gap:8px;font-size:13px;line-height:1.5;overflow-wrap:anywhere}.pc-action-status[data-tone="success"]{color:#24543a}.pc-action-status[data-tone="error"]{color:#8f312b}.pc-action-status svg{width:16px;height:16px;flex-shrink:0}@keyframes pc-action-spin{to{transform:rotate(360deg)}}@media(max-width:560px){.pc-notifications{inset:auto 16px 16px 16px;width:auto;max-height:50dvh}}@media(prefers-reduced-motion:reduce){.pc-notification-icon,[data-pc-pending]::before{animation:none!important}}
`;

export function installActionFeedback(css = ACTION_FEEDBACK_CSS) {
  if (typeof document === 'undefined') return;
  if (window.__pcFeedback) return window.__pcFeedback;
  const style = document.createElement('style');
  style.id = 'pc-action-feedback-styles'; style.textContent = css; document.head.append(style);
  let host;
  const records = new Map(), pending = new WeakMap(), keys = new WeakMap(), jobs = new Set();
  let sequence = 0;
  const paths = {
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    success: '<path d="m5 12 4 4L19 6"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3v1"/>',
    progress: '<path d="M21 12a9 9 0 1 1-9-9"/>',
  };
  const icon = name => '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+paths[name]+'</svg>';
  const destination = () => [...document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')].filter(node => !node.closest('[hidden]') && (!node.matches('dialog') || node.open)).at(-1) || document.body;
  const place = () => {
    if (!host) return;
    const parent=destination();
    if(host.parentElement!==parent)parent.append(host);
    if(typeof host.showPopover==='function'&&host.childElementCount){
      host.setAttribute('popover','manual');
      if(host.matches(':popover-open'))host.hidePopover();
      host.showPopover();
    }
  };
  const container = () => {
    if (!host?.isConnected) {
      host = document.createElement('div'); host.className = 'pc-notifications'; host.id = 'pc-notifications';
      host.setAttribute('aria-label','Notifications'); document.body.append(host);
      // Feedback belongs to the active dialog so its dismissal remains keyboard accessible.
    }
    return host;
  };
  const notify = (message, options = {}) => {
    const id = options.id || 'action-'+(++sequence);
    let record = records.get(id);
    if (!record) {
      const node = document.createElement('div'); node.className='pc-notification';
      const mark = document.createElement('span'); mark.className='pc-notification-icon'; mark.setAttribute('aria-hidden','true');
      const text = document.createElement('span'); text.className='pc-notification-message'; text.setAttribute('aria-atomic','true');
      const close = document.createElement('button'); close.type='button'; close.setAttribute('aria-label','Dismiss notification');
      close.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m6 6 12 12M6 18 18 6"/></svg>';
      node.append(mark,text,close); container().append(node);
      record={node,mark,text,timer:0,remaining:0,started:0}; records.set(id,record);
      close.onclick=()=>dismiss();
      node.addEventListener('mouseenter',()=>pause()); node.addEventListener('mouseleave',()=>resume());
      node.addEventListener('focusin',()=>pause()); node.addEventListener('focusout',()=>resume());
    }
    const dismiss = () => { clearTimeout(record.timer); record.node.remove(); records.delete(id); };
    const pause = () => { if(record.timer) { clearTimeout(record.timer);record.timer=0;record.remaining=Math.max(0,record.remaining-(Date.now()-record.started)); } };
    const resume = () => { if(!record.remaining||record.node.matches(':hover')||record.node.contains(document.activeElement))return; record.started=Date.now();record.timer=setTimeout(dismiss,record.remaining); };
    clearTimeout(record.timer); record.timer=0;
    const tone=options.tone || 'info'; record.node.dataset.tone=tone;
    record.mark.innerHTML=icon(tone); record.text.setAttribute('role',tone==='error'?'alert':'status');
    record.text.textContent=String(message); place();
    record.remaining=options.duration ?? (tone==='error'||tone==='progress'?0:5000); resume();
    // Retain errors and work in progress; discard only old transient confirmations.
    if(records.size>5) for(const [key,r] of records) { if(records.size<=5)break;if(key!==id&&!['error','progress'].includes(r.node.dataset.tone)){clearTimeout(r.timer);r.node.remove();records.delete(key);} }
    return { dismiss, update:(value,tone='progress')=>notify(value,{id,tone}), success:value=>notify(value,{id,tone:'success'}), error:value=>notify(value,{id,tone:'error'}) };
  };
  const begin = (button, message, key) => {
    if (button && pending.has(button)) return null;
    if(button&&!keys.has(button))keys.set(button,'button-'+(++sequence));
    const notice=notify(message,{tone:'progress',...(key?{id:'job-'+key}:button?{id:keys.get(button)}:{})});
    const snapshot=button?{html:button.innerHTML,disabled:button.disabled,busy:button.getAttribute('aria-busy'),label:button.getAttribute('aria-label'),ariaDisabled:button.getAttribute('aria-disabled')}:null;
    let done=false;
    if(button){pending.set(button,true);button.disabled=true;button.setAttribute('aria-busy','true');button.setAttribute('aria-disabled','true');button.setAttribute('aria-label',message);button.setAttribute('data-pc-pending','');button.textContent=message;}
    const restore=()=>{if(done)return false;done=true;if(button){pending.delete(button);button.innerHTML=snapshot.html;button.disabled=snapshot.disabled;button.removeAttribute('data-pc-pending');for(const [name,value] of [['aria-busy',snapshot.busy],['aria-label',snapshot.label],['aria-disabled',snapshot.ariaDisabled]]){if(value===null)button.removeAttribute(name);else button.setAttribute(name,value);}}return true;};
    return { update:notice.update, success:message=>{if(restore())notice.success(message);}, error:message=>{if(restore())notice.error(message);}, cancel:()=>{if(restore())notice.dismiss();} };
  };
  // Foreground work enters here once, at the user-action boundary, not once per fetch.
  // The key survives replacement of a button during a panel render. Callers receive a
  // result so a failed/cancelled operation can never accidentally continue as a success.
  const run = async (options, work) => {
    const key = options.key || options.button;
    if (key && jobs.has(key)) return {status:'busy'};
    const action = begin(options.button || null, options.pending, options.key);
    if (!action) return {status:'busy'};
    if (key) jobs.add(key);
    try {
      // CPU-heavy exports opt in; clipboard/file-picker actions retain user activation.
      if (options.paint) await new Promise(resolve => {
        const timer = setTimeout(resolve, 100);
        requestAnimationFrame(() => requestAnimationFrame(() => {clearTimeout(timer);resolve();}));
      });
      const value = await work({update:action.update});
      if (value === false) { action.cancel(); return {status:'cancelled'}; }
      action.success(typeof options.success === 'function' ? options.success(value) : options.success);
      return {status:'success',value};
    } catch (error) {
      if (error?.name === 'AbortError') {action.cancel();return {status:'cancelled'};}
      const message = typeof options.error === 'function' ? options.error(error)
        : options.error || (error?.message ? error.message + (/try again|retry|press|copy this/i.test(error.message) ? '' : ' Try again.') : 'Could not complete this action. Try again.');
      action.error(message);
      return {status:'error',error,message};
    } finally { if (key) jobs.delete(key); }
  };
  const flash = (message, path = location.pathname) => { try { sessionStorage.setItem('pc-action-result',JSON.stringify({message,at:Date.now(),path})); } catch {} };
  const restoreFlash = () => { try { const raw=sessionStorage.getItem('pc-action-result'); if(!raw)return;sessionStorage.removeItem('pc-action-result');const value=JSON.parse(raw);if(value.path===location.pathname&&Date.now()-value.at<60000)notify(value.message,{tone:'success',id:'navigation-result'}); } catch {} };
  if(document.body)restoreFlash();else document.addEventListener('DOMContentLoaded',restoreFlash,{once:true});
  const observer = new MutationObserver(()=>{if(host&&host.parentElement!==destination())place();});
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open','hidden']});
  const destroy=()=>{observer.disconnect();for(const record of records.values())clearTimeout(record.timer);records.clear();host?.remove();style.remove();document.removeEventListener('DOMContentLoaded',restoreFlash);delete window.__pcFeedback;};
  const api={notify,begin,run,flash,destroy}; window.__pcFeedback=api;
  return api;
}
export const ACTION_FEEDBACK_BOOT_SCRIPT = `(${installActionFeedback.toString()})(${JSON.stringify(ACTION_FEEDBACK_CSS)});`;
