export interface PreviewNavigation {
  /** The exact private snapshot files prefix, including its site and snapshot identity. */
  prefix: string;
  /** Actual HTML files from that snapshot's manifest. */
  pages: readonly string[];
}

/** Correlation only: authorization is always performed by the private snapshot route. */
export function withPreviewReadiness(html: string, token: string | undefined, navigation?: PreviewNavigation): string {
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) return html;
  const prefix = navigation ? '/' + navigation.prefix.replace(/^\/+|\/+$/g, '') + '/' : '';
  const pages = navigation?.pages.filter(path => /^[A-Za-z0-9._@+/-]+\.html$/i.test(path)
    && path.split('/').every(part => !!part && part !== '.' && part !== '..')) || [];
  // Config comes from the authorized route's manifest, never from an authored link or query.
  const config = JSON.stringify({ prefix, pages }).replace(/</g, '\\u003c');
  const script = `<script data-pagecraft-preview-readiness>(function(){
    const token=${JSON.stringify(token)};
    const navigation=${config};
    // The parent reloads known private pages: opaque frames cannot send their own auth cookies.
    if(navigation.prefix&&navigation.pages.length){
      document.addEventListener('click',function(event){
        if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
        const target=event.target;
        const anchor=target instanceof Element?target.closest('a[href]'):null;
        if(!anchor||anchor.hasAttribute('download'))return;
        const raw=anchor.getAttribute('href').trim();
        const targetName=anchor.getAttribute('target');
        if(!raw||raw[0]==='#'||(targetName&&targetName.toLowerCase()!=='_self'))return;
        let url;
        try{url=new URL(raw,document.baseURI);}catch{return;}
        if(url.origin!==new URL(location.href).origin||!url.pathname.startsWith(navigation.prefix))return;
        let path=url.pathname.slice(navigation.prefix.length);
        if(!path||path.endsWith('/'))path+='index.html';
        else if(!/\\.[a-z0-9]+$/i.test(path))path+='.html';
        if(!navigation.pages.includes(path)||url.hash.length>2048)return;
        event.preventDefault();
        parent.postMessage({type:'pagecraft-preview-navigate',token:token,path:path,hash:url.hash},'*');
      },true);
    }
    function start(){
      let finished=false, degraded=false;
      const cleanups=[];
      const finish=function(status){
        if(finished)return;
        finished=true;
        clearTimeout(deadline);
        cleanups.forEach(function(cleanup){cleanup();});
        requestAnimationFrame(function(){requestAnimationFrame(function(){
          parent.postMessage({type:'pagecraft-preview-ready',token:token,status:status},'*');
        });});
      };
      const deadline=setTimeout(function(){finish('degraded');},10000);
      const images=Array.from(document.images).filter(function(img){
        const r=img.getBoundingClientRect();
        return img.loading!=='lazy'||(r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth);
      });
      const waits=images.map(function(img){return new Promise(function(resolve){
        let settled=false;
        const done=function(ok){
          if(settled||finished)return;
          settled=true;
          img.removeEventListener('load',loaded);img.removeEventListener('error',failed);
          if(!ok){degraded=true;resolve();return;}
          if(typeof img.decode==='function')img.decode().catch(function(){degraded=true;}).then(resolve);
          else resolve();
        };
        const loaded=function(){done(img.naturalWidth>0);};
        const failed=function(){done(false);};
        cleanups.push(function(){img.removeEventListener('load',loaded);img.removeEventListener('error',failed);});
        if(img.complete){done(img.naturalWidth>0);return;}
        img.addEventListener('load',loaded);img.addEventListener('error',failed);
      });});
      if(document.fonts&&document.fonts.ready)waits.push(Promise.resolve(document.fonts.ready).catch(function(){degraded=true;}));
      Promise.all(waits).then(function(){finish(degraded?'degraded':'ready');});
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  })();</script>`;
  // Only the private response receives this bridge; immutable snapshot bytes stay intact.
  return /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, script + '</body>') : html + script;
}
