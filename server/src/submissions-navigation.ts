/** Same-document navigation for authorized inbox snapshots. Refresh always goes to the server. */
export function submissionsNavigation(prepared: Record<string, string>) {
  const data = JSON.stringify(prepared).replace(/</g, '\\u003c');
  return `<script>(()=>{
    const host=document.querySelector('.pc-manage-content');
    if(!host)return;
    const key=value=>{const u=new URL(value,location.href);for(const [k,v] of [...u.searchParams])if(!v||(k==='page'&&v==='1'))u.searchParams.delete(k);u.searchParams.sort();return u.pathname+u.search;};
    const cache=new Map(Object.entries(${data}).map(([url,html])=>[key(url),html]));
    const base=location.pathname;
    let controller=null, currentAction=null, deferred=null;
    const remember=(url,html)=>{cache.delete(key(url));cache.set(key(url),html);while(cache.size>10)cache.delete(cache.keys().next().value);};
    remember(location.href,host.innerHTML);
    const show=(html,url,push,focus=true)=>{const opener=document.activeElement?.getAttribute('data-open-dialog');host.innerHTML=html;if(!focus&&opener)[...host.querySelectorAll('[data-open-dialog]')].find(el=>el.getAttribute('data-open-dialog')===opener)?.focus({preventScroll:true});if(push)history.pushState(null,'',url);host.removeAttribute('aria-busy');if(focus){host.querySelector('h1')?.setAttribute('tabindex','-1');host.querySelector('h1')?.focus({preventScroll:true});document.querySelector('.pc-workspace')?.scrollTo(0,0);}};
    const flush=()=>{if(deferred&&!host.querySelector('dialog[open]')){const apply=deferred;deferred=null;apply();}};
    host.addEventListener('close',()=>queueMicrotask(flush),true);
    const go=async(url,push=true,refresh=false,button=null)=>{
      controller?.abort();currentAction?.cancel();deferred=null;controller=new AbortController();const request=controller;
      const saved=!refresh&&cache.get(key(url));const shownCache=saved&&!host.querySelector('dialog[open]');if(shownCache)show(saved,url,push);
      const action=window.__pcFeedback.begin(button,refresh?'Refreshing submissions…':'Loading submissions…','submissions-navigation',{announce:false});currentAction=action;
      host.setAttribute('aria-busy','true');
      const status=()=>{let el=host.querySelector('[data-refresh-status]');if(!el){el=document.createElement('div');el.className='pc-refresh-status';el.dataset.refreshStatus='';const heading=host.querySelector('header,h1');if(heading)heading.after(el);else host.append(el);}return el;};
      const announce=(message,tone='status')=>{const el=status();el.setAttribute('role',tone==='error'?'alert':'status');el.dataset.tone=tone;el.textContent=message;};
      announce('Checking for new submissions…');
      try{
        const response=await fetch(url,{signal:request.signal,credentials:'same-origin'});
        if(!response.ok||response.redirected)throw new Error('Could not load submissions. Refresh to try again.');
        const doc=new DOMParser().parseFromString(await response.text(),'text/html');
        const next=doc.querySelector('.pc-manage-content');if(!next)throw new Error('Could not load submissions. Refresh to try again.');
        if(controller!==request)return;
        const apply=()=>{if(controller!==request)return;if(refresh)cache.clear();remember(url,next.innerHTML);show(next.innerHTML,url,push&&!shownCache,!shownCache&&!refresh);action?.success('');announce(refresh?'Submissions refreshed.':'Submissions loaded.');};
        if(host.querySelector('dialog[open]')){deferred=apply;announce('New submission data is ready. Close the details to update the list.');host.removeAttribute('aria-busy');}else apply();
      }catch(error){if(controller!==request)return;if(error.name==='AbortError'){announce('');action?.cancel();}else{const message='Could not refresh submissions. Showing the last loaded entries. Check your connection and try Refresh again.';announce(message,'error');host.removeAttribute('aria-busy');action?.error(message);}}
    };
    host.addEventListener('click',event=>{
      const opener=event.target.closest('[data-open-dialog]');
      if(opener){const dialog=document.getElementById(opener.dataset.openDialog);if(dialog){dialog.showModal();dialog.addEventListener('close',()=>opener.focus(),{once:true});}return;}
      const closer=event.target.closest('[data-close-dialog]');if(closer){closer.closest('dialog').close();return;}
      if(event.target.matches('dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();return;}

      const link=event.target.closest('a');if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      if(link.matches('.pc-sub-export')){
        event.preventDefault();
        const action=window.__pcFeedback.begin(link,'Preparing CSV…');if(!action)return;
        (async()=>{try{const response=await fetch(link.href,{credentials:'same-origin'});if(!response.ok||response.redirected||!response.headers.get('content-type')?.includes('text/csv'))throw new Error('CSV export failed. Please try again.');const blob=await response.blob();const url=URL.createObjectURL(blob);const download=document.createElement('a');download.href=url;download.download='submissions.csv';document.body.append(download);download.click();download.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);action.success('CSV export ready. Download started.');}catch(error){action.error(error.message||'CSV export failed. Please try again.');}})();return;
      }
      const url=new URL(link.href);if(url.origin!==location.origin||url.pathname!==base)return;
      event.preventDefault();go(url.href,true,link.hasAttribute('data-inbox-refresh'),link);
    });
    host.addEventListener('submit',event=>{
      const form=event.target;if(!form.matches('.pc-sub-filters'))return;
      event.preventDefault();const url=new URL(base,location.origin);url.search=new URLSearchParams(new FormData(form)).toString();go(url.href,true,false,event.submitter);
    });
    window.addEventListener('popstate',()=>go(location.href,false));
    window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===parent&&event.data==='pagecraft:refresh-submissions')go(location.href,false,true);});
  })();</script>`;
}
