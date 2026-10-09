/** Correlation only: authorization is always performed by the private snapshot route. */
export function withPreviewReadiness(html: string, token: string | undefined): string {
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) return html;
  const script = `<script data-pagecraft-preview-readiness>(function(){
    const token=${JSON.stringify(token)};
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
  // Only the private response receives this diagnostic; immutable snapshot bytes stay intact.
  return /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, script + '</body>') : html + script;
}
