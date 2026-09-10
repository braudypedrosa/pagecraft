/** Enhance ordinary Cloud POST forms; custom asynchronous flows keep their own handlers. */
export function installAccountActions() {
  const feedback = window.__pcFeedback;
  if (!feedback || window.__pcAccountActions) return;
  window.__pcAccountActions = true;
  const native = new WeakMap(), active = new Set();
  const label = form => {
    const path = new URL(form.action, location.href).pathname;
    if (/delete|remove/.test(path)) return 'Deleting…';
    if (/invite/.test(path)) return 'Sending invitation…';
    if (/login/.test(path)) return 'Signing in…';
    if (/logout/.test(path)) return 'Signing out…';
    if (/signup/.test(path)) return 'Creating account…';
    if (/forgot-password/.test(path)) return 'Sending reset link…';
    if (/reset-password|password/.test(path)) return 'Updating password…';
    return 'Saving changes…';
  };
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (event.defaultPrevented || !(form instanceof HTMLFormElement) || form.method.toLowerCase() !== 'post') return;
    const url = new URL(form.action, location.href);
    if (url.origin !== location.origin) return;
    const button = event.submitter || form.querySelector('button[type="submit"],button:not([type]),input[type="submit"]');
    // OAuth needs a real cross-origin navigation, not fetch following its redirect.
    if (url.pathname === '/auth/google') {
      if(native.has(form)){event.preventDefault();return;}
      const action=feedback.begin(button, 'Opening Google sign-in…');
      native.set(form,{restore:()=>{action?.cancel();native.delete(form);}});
      return;
    }
    event.preventDefault();
    if (native.has(form)) return;
    const data = new FormData(form);
    if(event.submitter?.name) data.append(event.submitter.name,event.submitter.value);
    const action=feedback.begin(button,label(form));
    if(!action)return;
    const controls=[...form.querySelectorAll('input,select,textarea,button')].filter(control=>control!==button).map(control=>[control,control.disabled]);
    const restore=()=>{action.cancel();controls.forEach(([control,disabled])=>control.disabled=disabled);native.delete(form);active.delete(form);form.removeAttribute('aria-busy');};
    native.set(form,{restore}); active.add(form); form.setAttribute('aria-busy','true');controls.forEach(([control])=>control.disabled=true);
    form.querySelector('[data-action-error]')?.remove();
    try {
      const response=await fetch(url.href,{method:'POST',credentials:'same-origin',headers:{accept:'text/html'},body:new URLSearchParams(data)});
      const text=await response.text(), result=new DOMParser().parseFromString(text,'text/html');
      const error=result.querySelector('.notice.error,[data-action-error]')?.textContent?.trim();
      const target=new URL(response.url || url.href,location.href);
      if(!response.ok||error||target.searchParams.has('error')) {
        throw new Error(error || (!response.ok&&!/<[a-z][\s\S]*>/i.test(text)?text.slice(0,500):'Could not complete this action. Your input is still here. Try again.'));
      }
      if(!url.pathname.startsWith('/auth/') && target.pathname==='/login')throw new Error('Your session expired. Sign in again, then retry. Your input is still here.');
      if(target.origin!==location.origin)throw new Error('Could not complete this action. Refresh and try again.');
      // Only the server response confirms completion. Its redirect carries success copy.
      const success=result.querySelector('.notice[role="status"]')?.textContent?.trim();
      const completed = success || (/delete|remove/.test(url.pathname) ? 'Deleted successfully.' : /logout/.test(url.pathname) ? 'Signed out.' : /login/.test(url.pathname) ? 'Signed in.' : /signup/.test(url.pathname) ? 'Account created. Check your email to confirm it.' : 'Changes saved.');
      action.update('Done. Opening the updated page…');
      feedback.flash(completed, target.pathname);
      active.delete(form);location.assign(target.href);
    } catch(error) {
      const message=error instanceof TypeError
        ? 'Connection lost. Your input is still here. Check whether the change was saved before trying again.'
        : error.message || 'Could not complete this action. Try again.';
      action.error(message);
      const notice=document.createElement('p');notice.className='notice error';notice.dataset.actionError='';notice.textContent=message;notice.tabIndex=-1;form.prepend(notice);notice.focus();
      restore();
    }
  });
  window.addEventListener('beforeunload',event=>{if(active.size){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pageshow',event=>{
    if(!event.persisted)return;
    document.querySelectorAll('form').forEach(form=>{native.get(form)?.restore();});
  });
  const announce = () => {
    document.querySelectorAll('.notice[role="status"],.notice.error[role="alert"]').forEach(node=>{
      if(node.textContent.trim())feedback.notify(node.textContent.trim(),{tone:node.classList.contains('error')?'error':'success',id:'navigation-result'});
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',announce,{once:true});else announce();
}
export const ACCOUNT_ACTIONS_BOOT_SCRIPT=`(${installAccountActions.toString()})();`;
