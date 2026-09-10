/** Same-document navigation for authorized inbox snapshots. Refresh always goes to the server. */
export function submissionsNavigation(prepared: Record<string, string>) {
  const data = JSON.stringify(prepared).replace(/</g, '\\u003c');
  return `<script>(()=>{
    const host=document.querySelector('.pc-manage-content');
    if(!host)return;
    const key=value=>{const u=new URL(value,location.href);for(const [k,v] of [...u.searchParams])if(!v||(k==='page'&&v==='1'))u.searchParams.delete(k);u.searchParams.sort();return u.pathname+u.search;};
    const cache=new Map(Object.entries(${data}).map(([url,html])=>[key(url),html]));
    const base=location.pathname;
    let controller=null;
    const remember=(url,html)=>{cache.delete(key(url));cache.set(key(url),html);while(cache.size>10)cache.delete(cache.keys().next().value);};
    remember(location.href,host.innerHTML);
    const show=(html,url,push)=>{host.innerHTML=html;if(push)history.pushState(null,'',url);host.removeAttribute('aria-busy');host.querySelector('h1')?.setAttribute('tabindex','-1');host.querySelector('h1')?.focus({preventScroll:true});document.querySelector('.pc-workspace')?.scrollTo(0,0);};
    const go=async(url,push=true)=>{
      controller?.abort();controller=new AbortController();const request=controller;
      const saved=cache.get(key(url));if(saved){show(saved,url,push);return;}
      host.setAttribute('aria-busy','true');
      const notice=document.createElement('p');notice.setAttribute('role','status');notice.textContent='Loading submissions…';host.prepend(notice);
      try{
        const response=await fetch(url,{signal:request.signal,credentials:'same-origin'});
        if(!response.ok||response.redirected)throw new Error('Could not load submissions. Refresh to try again.');
        const doc=new DOMParser().parseFromString(await response.text(),'text/html');
        const next=doc.querySelector('.pc-manage-content');if(!next)throw new Error('Could not load submissions. Refresh to try again.');
        if(controller!==request)return;
        remember(url,next.innerHTML);show(next.innerHTML,url,push);
      }catch(error){if(error.name==='AbortError')notice.remove();else{notice.textContent=error.message;host.removeAttribute('aria-busy');}}
    };
    host.addEventListener('click',event=>{
      const link=event.target.closest('a');if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.hasAttribute('data-inbox-refresh'))return;
      const url=new URL(link.href);if(url.origin!==location.origin||url.pathname!==base)return;
      event.preventDefault();go(url.href);
    });
    host.addEventListener('submit',event=>{
      const form=event.target;if(!form.matches('.pc-sub-filters'))return;
      event.preventDefault();const url=new URL(base,location.origin);url.search=new URLSearchParams(new FormData(form)).toString();go(url.href);
    });
    window.addEventListener('popstate',()=>go(location.href,false));
  })();</script>`;
}
