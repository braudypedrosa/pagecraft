/** Compact topbar notifications menu for Cloud account pages. */
export const NOTIFY_MENU_CSS = `
.pc-notify{position:relative;flex-shrink:0;height:52px;display:flex;align-items:center}
.pc-notify>summary{list-style:none;cursor:pointer;position:relative}
.pc-notify>summary::-webkit-details-marker{display:none}
.pc-notify-badge{position:absolute;top:6px;right:6px;min-width:8px;height:8px;padding:0;border:2px solid var(--pc-rail);border-radius:999px;background:var(--pc-green);box-sizing:content-box;pointer-events:none}
.pc-notify-badge[data-count]:not([data-count=""]){top:4px;right:2px;min-width:16px;height:16px;padding:0 4px;border-width:2px;display:grid;place-items:center;color:var(--pc-on-green);font-family:"DM Sans",system-ui,sans-serif;font-size:.58rem;font-weight:700;line-height:1}
.pc-notify-panel{position:absolute;right:0;top:46px;width:min(340px,calc(100vw - 24px));padding:10px;background:var(--pc-panel,#fff);border:1px solid var(--pc-line,var(--pc-border));border-radius:8px;box-shadow:0 14px 30px rgba(17,19,17,.16);color:var(--pc-text,#171a17);z-index:60}
.pc-notify-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 6px 10px;border-bottom:1px solid var(--pc-line,var(--pc-border))}
.pc-notify-head strong{font-size:.82rem;font-weight:650;letter-spacing:-.01em}
.pc-notify-head a{font-family:"DM Sans",system-ui,sans-serif;font-size:.7rem;font-weight:600;color:var(--pc-text-2,#6f7771);text-decoration:none}
.pc-notify-head a:hover{color:var(--pc-text,#171a17);text-decoration:underline;text-underline-offset:2px}
.pc-notify-list{display:grid;gap:2px;padding-top:6px;max-height:min(360px,50vh);overflow:auto}
.pc-notify-item{display:grid;grid-template-columns:36px minmax(0,1fr);gap:10px;align-items:start;padding:10px 8px;border-radius:6px;color:inherit;text-decoration:none}
.pc-notify-item:hover{background:var(--pc-hover-bg,#f4faef)}
.pc-notify-item-icon{width:36px;height:36px;display:grid;place-items:center;border:1px solid var(--pc-line,var(--pc-border));border-radius:50%;background:var(--pc-panel,#fff);color:var(--pc-text,#171a17)}
.pc-notify-item-icon svg{display:block;width:16px;height:16px}
.pc-notify-item.is-new .pc-notify-item-icon{border-color:#c5d9b0;background:#f4f8ef}
.pc-notify-item-copy{min-width:0;display:grid;gap:3px;padding-top:2px}
.pc-notify-item-copy strong{font-size:.78rem;font-weight:650;line-height:1.35;color:var(--pc-text,#171a17)}
.pc-notify-item-copy time{font-family:"DM Sans",system-ui,sans-serif;font-size:.68rem;color:var(--pc-text-2,#6f7771)}
.pc-notify-empty{margin:0;padding:18px 8px;color:var(--pc-text-2,#6f7771);font-size:.78rem;line-height:1.45}
`;

export const NOTIFY_MENU_BOOT_SCRIPT = `(()=>{
  const root=document.querySelector('[data-notify-root]');
  if(!root||window.__pcNotifyMenu)return;
  window.__pcNotifyMenu=true;
  const list=root.querySelector('[data-notify-list]');
  const badge=root.querySelector('[data-notify-badge]');
  const account=document.getElementById('account-menu');
  let loaded=false;
  const closeOther=()=>{if(account?.open)account.open=false;};
  const setBadge=(count)=>{
    if(!badge)return;
    if(!count){badge.hidden=true;badge.removeAttribute('data-count');badge.textContent='';return;}
    badge.hidden=false;
    if(count>9){badge.setAttribute('data-count','9+');badge.textContent='9+';}
    else if(count>1){badge.setAttribute('data-count',String(count));badge.textContent=String(count);}
    else{badge.removeAttribute('data-count');badge.textContent='';}
  };
  const load=async()=>{
    if(!list)return;
    try{
      const examples=new URLSearchParams(location.search).get('examples')==='1'?'?examples=1':'';
      const response=await fetch('/api/notifications/mini'+examples,{credentials:'same-origin',headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('unavailable');
      const data=await response.json();
      setBadge(Number(data.unread)||0);
      list.innerHTML=data.listHtml||'<p class="pc-notify-empty">No notifications yet.</p>';
      loaded=true;
    }catch{
      if(!loaded)list.innerHTML='<p class="pc-notify-empty">Notifications could not be loaded. <a href="/notifications">Open inbox</a></p>';
    }
  };
  root.addEventListener('toggle',()=>{
    if(root.open){closeOther();load();}
  });
  account?.addEventListener('toggle',()=>{if(account.open)root.open=false;});
  document.addEventListener('pointerdown',event=>{
    if(root.open&&!event.target.closest('.pc-notify'))root.open=false;
  });
  load();
})();`;
