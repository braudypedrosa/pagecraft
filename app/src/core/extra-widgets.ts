/** Styling and progressive runtime enhancements for Audio, Countdown, Marquee, Filter, Compare, Timeline, Progress, Hotspot, Strips, and Switcher widgets. */

export const FLOATING_SECTION_CSS = `.pagecraft-section[data-floating="1"]:not([data-floating-edit]){position:absolute;inset-inline:0;inset-block-start:0;z-index:40}:where(.pagecraft-section[data-floating="1"]:not([data-floating-edit])){background:transparent}`;

export const AUDIO_CSS = `.pagecraft-audio{display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;background:var(--au-bg,#f6f6f3);color:var(--au-text,#18181b);border:1px solid var(--au-line,rgba(0,0,0,.12));border-radius:var(--au-radius,12px);box-sizing:border-box}
.pagecraft-audio-art{width:56px;height:56px;border-radius:calc(var(--au-radius,12px) * .65);object-fit:cover;flex:none;background:rgba(0,0,0,.06)}
.pagecraft-audio-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:8px}
.pagecraft-audio-head{min-width:0;display:flex;flex-direction:column;gap:2px}
.pagecraft-audio-title{font-weight:600;font-size:var(--au-title-size,15px);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pagecraft-audio-sub{font-size:13px;line-height:1.35;color:var(--au-muted,#666);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pagecraft-audio-bar{display:flex;align-items:center;gap:12px}
.pagecraft-audio-btn{width:40px;height:40px;border-radius:999px;border:0;background:var(--au-accent,#18181b);color:var(--au-accent-ink,#ffffff);display:inline-grid;place-items:center;flex:none;cursor:pointer;padding:0;transition:transform .15s ease,opacity .15s ease}
.pagecraft-audio-btn:hover:not([disabled]){transform:scale(1.04)}
.pagecraft-audio-btn[disabled]{opacity:.45;cursor:not-allowed}
.pagecraft-audio-ic-pause{display:none}
.pagecraft-audio[data-playing] .pagecraft-audio-ic-play{display:none}
.pagecraft-audio[data-playing] .pagecraft-audio-ic-pause{display:block}
.pagecraft-audio-track{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.pagecraft-audio-range{width:100%;margin:0;accent-color:var(--au-accent,#18181b);cursor:pointer}
.pagecraft-audio-range[disabled]{cursor:not-allowed;opacity:.45}
.pagecraft-audio-times{display:flex;justify-content:space-between;font-size:12px;line-height:1.2;font-variant-numeric:tabular-nums;color:var(--au-muted,#666)}
.pagecraft-audio-rate{min-height:32px;padding:4px 9px;border:1px solid var(--au-line,rgba(0,0,0,.16));border-radius:999px;background:transparent;color:inherit;font:600 12px/1 inherit;cursor:pointer;flex:none}
.pagecraft-audio-btn:focus-visible,.pagecraft-audio-range:focus-visible,.pagecraft-audio-rate:focus-visible{outline:2px solid var(--au-accent,currentColor);outline-offset:2px}
.pagecraft-audio-native{display:block;width:100%;margin-top:4px;height:36px}
.pagecraft-audio[data-audio-edit] .pagecraft-audio-native,.pagecraft-audio[data-pc-audio-ready] .pagecraft-audio-native{display:none}
.pagecraft-audio[data-audio-compact] .pagecraft-audio-track,.pagecraft-audio[data-audio-compact] .pagecraft-audio-rate{display:none}`;

export const AUDIO_JS = `<script>
(function(){
  var players=[];
  function fmt(sec){
    if(!isFinite(sec)||sec<0)return '0:00';
    var total=Math.floor(sec);
    var h=Math.floor(total/3600);
    var m=Math.floor((total%3600)/60);
    var s=total%60;
    return (h>0?h+':'+(m<10?'0':'')+m:String(m))+':'+(s<10?'0':'')+s;
  }
  function pauseOthers(current){
    document.querySelectorAll('.pagecraft-audio audio').forEach(function(other){
      if(other!==current&&!other.paused)try{other.pause();}catch(e){}
    });
  }
  document.querySelectorAll('.pagecraft-audio[data-audio]').forEach(function(root){
    if(root.hasAttribute('data-pc-audio-ready'))return;
    var el=root.querySelector('audio.pagecraft-audio-native');
    var btn=root.querySelector('[data-audio-toggle]');
    var seek=root.querySelector('[data-audio-seek]');
    var cur=root.querySelector('[data-audio-cur]');
    var dur=root.querySelector('[data-audio-dur]');
    var rateBtn=root.querySelector('[data-audio-rate]');
    if(!el||!btn)return;
    root.setAttribute('data-pc-audio-ready','');
    var title=root.getAttribute('data-audio-title')||'audio';
    var rates=[1,1.25,1.5,2];
    var rateIndex=0;
    function syncTime(){
      var d=el.duration;
      var t=el.currentTime||0;
      if(cur)cur.textContent=fmt(t);
      if(dur&&isFinite(d)&&d>0)dur.textContent=fmt(d);
      if(seek&&isFinite(d)&&d>0)seek.value=String(Math.min(100,Math.max(0,(t/d)*100)));
    }
    function syncState(){
      var playing=!el.paused&&!el.ended;
      if(playing)root.setAttribute('data-playing','');
      else root.removeAttribute('data-playing');
      btn.setAttribute('aria-pressed',playing?'true':'false');
      btn.setAttribute('aria-label',(playing?'Pause ':'Play ')+title);
    }
    function onToggle(){
      if(btn.disabled)return;
      if(el.paused||el.ended){
        pauseOthers(el);
        try{
          var res=el.play();
          if(res&&typeof res.catch==='function')res.catch(function(){syncState();});
        }catch(e){syncState();}
      }else{
        try{el.pause();}catch(e){}
      }
      syncState();
    }
    function onSeek(){
      if(!seek)return;
      var d=el.duration;
      if(!isFinite(d)||d<=0)return;
      var pct=parseFloat(seek.value);
      if(isFinite(pct))el.currentTime=Math.max(0,Math.min(d,(pct/100)*d));
      syncTime();
    }
    function onRate(){
      if(!rateBtn)return;
      rateIndex=(rateIndex+1)%rates.length;
      var next=rates[rateIndex];
      el.playbackRate=next;
      rateBtn.textContent=next+'x';
      rateBtn.setAttribute('aria-label','Playback speed: '+next+'x');
    }
    btn.addEventListener('click',onToggle);
    if(seek)seek.addEventListener('input',onSeek);
    if(rateBtn)rateBtn.addEventListener('click',onRate);
    el.addEventListener('timeupdate',syncTime);
    el.addEventListener('loadedmetadata',syncTime);
    el.addEventListener('durationchange',syncTime);
    el.addEventListener('play',syncState);
    el.addEventListener('pause',syncState);
    el.addEventListener('ended',syncState);
    syncTime();syncState();
    players.push(function(){
      try{el.pause();}catch(e){}
      btn.removeEventListener('click',onToggle);
      if(seek)seek.removeEventListener('input',onSeek);
      if(rateBtn)rateBtn.removeEventListener('click',onRate);
      el.removeEventListener('timeupdate',syncTime);
      el.removeEventListener('loadedmetadata',syncTime);
      el.removeEventListener('durationchange',syncTime);
      el.removeEventListener('play',syncState);
      el.removeEventListener('pause',syncState);
      el.removeEventListener('ended',syncState);
      root.removeAttribute('data-pc-audio-ready');
      root.removeAttribute('data-playing');
    });
  });
  if(players.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      players.forEach(function(dispose){dispose();});
    });
  }
})();
</script>
`;

export const COUNTDOWN_CSS = `.pagecraft-countdown{width:100%;color:var(--cd2-text,inherit)}
.pagecraft-countdown-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(72px,1fr));gap:var(--cd2-gap,12px)}
.pagecraft-countdown-grid[hidden],.pagecraft-countdown-done[hidden]{display:none}
.pagecraft-countdown-unit{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:16px 12px;background:var(--cd2-card,#f6f6f3);border:1px solid var(--cd2-line,rgba(0,0,0,.1));border-radius:var(--cd2-radius,10px);text-align:center}
.pagecraft-countdown-val{font-size:var(--cd2-num-size,clamp(1.75rem,4vw,2.75rem));font-weight:700;line-height:1;font-variant-numeric:tabular-nums;color:var(--cd2-num,inherit)}
.pagecraft-countdown-lbl{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--cd2-muted,#666)}
.pagecraft-countdown-inline .pagecraft-countdown-grid{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--cd2-gap,20px)}
.pagecraft-countdown-inline .pagecraft-countdown-unit{flex-direction:row;align-items:baseline;gap:6px;padding:0;background:transparent;border:0;border-radius:0}
.pagecraft-countdown-done{padding:14px 16px;border-radius:var(--cd2-radius,10px);background:var(--cd2-card,#f6f6f3);border:1px solid var(--cd2-line,rgba(0,0,0,.1));font-weight:600;text-align:center}`;

export const COUNTDOWN_JS = `<script>
(function(){
  var disposers=[];
  function pad(n){return n<10?'0'+n:String(n);}
  document.querySelectorAll('.pagecraft-countdown[data-countdown]').forEach(function(root){
    if(root.hasAttribute('data-pc-cd-ready'))return;
    var raw=root.getAttribute('data-countdown')||'';
    var targetMs=Date.parse(raw);
    if(!isFinite(targetMs))return;
    root.setAttribute('data-pc-cd-ready','');
    var grid=root.querySelector('[data-cd-grid]');
    var ended=root.querySelector('[data-cd-ended]');
    var uD=root.querySelector('[data-cd-unit="d"]');
    var uH=root.querySelector('[data-cd-unit="h"]');
    var uM=root.querySelector('[data-cd-unit="m"]');
    var uS=root.querySelector('[data-cd-unit="s"]');
    var timer=0;
    function stop(){if(timer){clearInterval(timer);timer=0;}}
    function tick(){
      var diff=targetMs-Date.now();
      if(diff<=0){
        if(uD)uD.textContent='0';
        if(uH)uH.textContent='00';
        if(uM)uM.textContent='00';
        if(uS)uS.textContent='00';
        if(grid)grid.hidden=true;
        if(ended)ended.hidden=false;
        stop();
        return false;
      }
      var totalSec=Math.floor(diff/1000);
      var days=Math.floor(totalSec/86400);
      var hours=Math.floor((totalSec%86400)/3600);
      var mins=Math.floor((totalSec%3600)/60);
      var secs=totalSec%60;
      if(grid)grid.hidden=false;
      if(ended)ended.hidden=true;
      if(uD)uD.textContent=String(days);
      if(uH)uH.textContent=pad(hours);
      if(uM)uM.textContent=pad(mins);
      if(uS)uS.textContent=pad(secs);
      return true;
    }
    if(tick())timer=setInterval(tick,1000);
    disposers.push(function(){
      stop();
      root.removeAttribute('data-pc-cd-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
</script>
`;

export const MARQUEE_CSS = `.pagecraft-marquee{display:flex;overflow:hidden;user-select:none;gap:var(--mq-gap,32px);width:100%}
.pagecraft-marquee[data-marquee-edit]{flex-wrap:wrap;overflow:visible}
.pagecraft-marquee-fade{-webkit-mask-image:linear-gradient(to right,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(to right,transparent,#000 8%,#000 92%,transparent)}
.pagecraft-marquee-track{display:flex;align-items:center;flex:none;min-width:100%;gap:var(--mq-gap,32px);animation:pagecraft-marquee var(--mq-speed,28s) linear infinite}
.pagecraft-marquee[data-marquee-edit] .pagecraft-marquee-track{animation:none;flex-wrap:wrap;width:100%;min-width:0}
.pagecraft-marquee[data-marquee-dir=right] .pagecraft-marquee-track{animation-direction:reverse}
.pagecraft-marquee[data-marquee-pause="1"]:hover .pagecraft-marquee-track,.pagecraft-marquee[data-marquee-pause="1"]:focus-within .pagecraft-marquee-track{animation-play-state:paused}
@keyframes pagecraft-marquee{from{transform:translateX(0)}to{transform:translateX(calc(-100% - var(--mq-gap,32px)))}}
@media (prefers-reduced-motion:reduce){.pagecraft-marquee{flex-wrap:wrap;overflow:visible;-webkit-mask-image:none;mask-image:none}.pagecraft-marquee-track{animation:none;flex-wrap:wrap;width:100%;min-width:0}.pagecraft-marquee-dup{display:none}}`;

export const FILTER_CSS = `.pagecraft-filter{display:flex;flex-direction:column;gap:var(--fl-gap,24px);width:100%}
.pagecraft-filter-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.pagecraft-filter-btn{min-height:38px;padding:7px 15px;border-radius:var(--fl-pill-radius,999px);border:1px solid var(--fl-line,rgba(0,0,0,.16));background:var(--fl-btn-bg,transparent);color:var(--fl-btn-text,inherit);font:500 14px/1.2 inherit;cursor:pointer;transition:background-color .15s ease,color .15s ease,border-color .15s ease}
.pagecraft-filter-btn:hover{border-color:var(--fl-accent,currentColor)}
.pagecraft-filter-btn:focus-visible{outline:2px solid var(--fl-accent,currentColor);outline-offset:2px}
.pagecraft-filter-btn.is-active,.pagecraft-filter-btn[aria-selected=true]{background:var(--fl-accent,#18181b);color:var(--fl-accent-ink,#ffffff);border-color:var(--fl-accent,#18181b)}
.pagecraft-filter-grid{display:grid;grid-template-columns:var(--fl-cols,minmax(0,1fr));gap:var(--fl-gap,20px)}
.pagecraft-filter [data-filter-hidden]{display:none !important}
.pagecraft-filter-empty{margin:0;padding:20px;border:1px dashed var(--fl-line,rgba(0,0,0,.16));border-radius:10px;text-align:center;color:var(--fl-muted,#666)}
.pagecraft-filter-empty[hidden]{display:none}`;

export const FILTER_JS = `<script>
(function(){
  var disposers=[];
  function splitTags(str){
    return String(str||'').split(',').map(function(s){return s.trim().toLowerCase();}).filter(Boolean);
  }
  document.querySelectorAll('.pagecraft-filter[data-filter-group]').forEach(function(root){
    if(root.hasAttribute('data-pc-filter-ready'))return;
    var btns=Array.from(root.querySelectorAll(':scope > .pagecraft-filter-bar [data-filter-btn]'));
    if(!btns.length)return;
    root.setAttribute('data-pc-filter-ready','');
    var items=Array.from(root.querySelectorAll('[data-filter-tags]'));
    var empty=root.querySelector(':scope > [data-filter-empty]');
    function selectTag(tag,focusBtn){
      var want=String(tag||'*').trim().toLowerCase();
      var shown=0;
      btns.forEach(function(btn){
        var bTag=String(btn.getAttribute('data-filter-tag')||'*').trim().toLowerCase();
        var active=bTag===want;
        btn.classList.toggle('is-active',active);
        btn.setAttribute('aria-selected',active?'true':'false');
        btn.setAttribute('tabindex',active?'0':'-1');
        if(active&&focusBtn)try{btn.focus();}catch(e){}
      });
      items.forEach(function(item){
        var itemTags=splitTags(item.getAttribute('data-filter-tags'));
        var match=want==='*'||itemTags.indexOf(want)>=0;
        if(match){item.removeAttribute('data-filter-hidden');item.hidden=false;shown++;}
        else{item.setAttribute('data-filter-hidden','');item.hidden=true;}
      });
      if(empty)empty.hidden=!(want!=='*'&&items.length>0&&shown===0);
    }
    var onClicks=[];
    btns.forEach(function(btn,idx){
      function onClick(){selectTag(btn.getAttribute('data-filter-tag'),false);}
      function onKey(e){
        var next=-1;
        if(e.key==='ArrowRight')next=(idx+1)%btns.length;
        else if(e.key==='ArrowLeft')next=(idx-1+btns.length)%btns.length;
        else if(e.key==='Home')next=0;
        else if(e.key==='End')next=btns.length-1;
        if(next>=0){e.preventDefault();selectTag(btns[next].getAttribute('data-filter-tag'),true);}
      }
      btn.addEventListener('click',onClick);
      btn.addEventListener('keydown',onKey);
      onClicks.push(function(){btn.removeEventListener('click',onClick);btn.removeEventListener('keydown',onKey);});
    });
    selectTag('*',false);
    disposers.push(function(){
      onClicks.forEach(function(off){off();});
      items.forEach(function(item){item.removeAttribute('data-filter-hidden');item.hidden=false;});
      if(empty)empty.hidden=true;
      root.removeAttribute('data-pc-filter-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
</script>
`;

export const COMPARE_CSS = `.pagecraft-compare{position:relative;width:100%;overflow:clip;border-radius:var(--cmp-radius,12px);aspect-ratio:var(--cmp-ratio,16 / 9);user-select:none;background:var(--c-surface,#14171d);--cmp-pos:50%}
.pagecraft-compare-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.pagecraft-compare-before{clip-path:inset(0 calc(100% - var(--cmp-pos,50%)) 0 0)}
.pagecraft-compare-tag{position:absolute;inset-block-end:14px;padding:5px 11px;border-radius:999px;background:rgba(15,18,22,.74);color:#fff;font:600 12px/1.2 inherit;letter-spacing:.05em;text-transform:uppercase;backdrop-filter:blur(8px);pointer-events:none;z-index:2}
.pagecraft-compare-tag[data-side=before]{inset-inline-start:14px}
.pagecraft-compare-tag[data-side=after]{inset-inline-end:14px}
.pagecraft-compare-handle{position:absolute;inset-block:0;inset-inline-start:var(--cmp-pos,50%);width:2px;background:var(--cmp-accent,#fff);transform:translateX(-50%);pointer-events:none;z-index:3;box-shadow:0 0 0 1px rgba(0,0,0,.28)}
.pagecraft-compare-knob{position:absolute;inset-block-start:50%;inset-inline-start:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:999px;background:var(--cmp-accent,#fff);color:var(--cmp-ink,#111311);display:grid;place-items:center;box-shadow:0 4px 16px rgba(0,0,0,.34)}
.pagecraft-compare-range{appearance:none;-webkit-appearance:none;position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;background:transparent;cursor:ew-resize;z-index:4;outline:none}
.pagecraft-compare[data-compare-edit] .pagecraft-compare-range{pointer-events:none}
.pagecraft-compare-range::-webkit-slider-runnable-track{height:100%;background:transparent}
.pagecraft-compare-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:44px;height:100%;background:transparent;border:0}
.pagecraft-compare-range::-moz-range-track{height:100%;background:transparent}
.pagecraft-compare-range::-moz-range-thumb{width:44px;height:100%;background:transparent;border:0}
.pagecraft-compare-range:focus-visible{outline:3px solid var(--cmp-accent,#fff);outline-offset:-3px;box-shadow:inset 0 0 0 5px rgba(0,0,0,.45)}`;

export const COMPARE_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-compare[data-compare]').forEach(function(root){
    if(root.hasAttribute('data-pc-cmp-ready'))return;
    var range=root.querySelector('[data-compare-range]');
    if(!range)return;
    root.setAttribute('data-pc-cmp-ready','');
    function sync(){
      var v=Math.max(0,Math.min(100,parseFloat(range.value)||50));
      root.style.setProperty('--cmp-pos',v+'%');
      range.setAttribute('aria-valuetext',Math.round(v)+'%');
    }
    range.addEventListener('input',sync);
    sync();
    disposers.push(function(){
      range.removeEventListener('input',sync);
      root.removeAttribute('data-pc-cmp-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
</script>
`;

export const TIMELINE_CSS = `.pagecraft-timeline{position:relative;list-style:none;margin:0;padding:0;width:100%;counter-reset:pc-tl}
.pagecraft-timeline[data-orientation=vertical]{display:flex;flex-direction:column;gap:var(--tl-gap,22px);padding-inline-start:42px}
.pagecraft-timeline[data-orientation=vertical]::before{content:"";position:absolute;inset-inline-start:15px;inset-block:18px;inline-size:2px;background:var(--tl-line,rgba(0,0,0,.16))}
.pagecraft-timeline[data-orientation=horizontal]{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--tl-gap,20px)}
.pagecraft-timeline[data-orientation=horizontal]::before{content:"";position:absolute;inset-inline:24px;inset-block-start:15px;block-size:2px;background:var(--tl-line,rgba(0,0,0,.16))}
.pagecraft-timeline-item{position:relative;counter-increment:pc-tl;min-width:0}
.pagecraft-timeline-mark{width:30px;height:30px;border-radius:999px;background:var(--tl-accent,#18181b);color:var(--tl-accent-ink,#fff);display:inline-grid;place-items:center;font:700 12px/1 inherit;font-variant-numeric:tabular-nums;position:relative;z-index:1}
.pagecraft-timeline[data-orientation=vertical] .pagecraft-timeline-mark{position:absolute;inset-inline-start:-41px;inset-block-start:16px}
.pagecraft-timeline[data-orientation=horizontal] .pagecraft-timeline-mark{margin-block-end:14px}
.pagecraft-timeline[data-marker=numbers] .pagecraft-timeline-mark::after{content:counter(pc-tl)}
.pagecraft-timeline[data-marker=dots] .pagecraft-timeline-mark{width:14px;height:14px;border:3px solid var(--tl-card,#fff);box-sizing:border-box}
.pagecraft-timeline[data-orientation=vertical][data-marker=dots] .pagecraft-timeline-mark{inset-inline-start:-33px;inset-block-start:24px}
.pagecraft-timeline[data-orientation=horizontal][data-marker=dots] .pagecraft-timeline-mark{margin-block:8px 22px}
.pagecraft-timeline-card{background:var(--tl-card,transparent);border:1px solid var(--tl-line,rgba(0,0,0,.14));border-radius:var(--tl-radius,10px);padding:18px 20px;display:flex;flex-direction:column;gap:6px}
.pagecraft-timeline-tag{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--tl-accent,currentColor)}
.pagecraft-timeline-title{margin:0;font-size:var(--tl-title-size,18px);font-weight:700;line-height:1.3;color:var(--tl-ink,inherit)}
.pagecraft-timeline-detail{margin:0;font-size:var(--tl-body-size,15px);line-height:1.55;color:var(--tl-muted,inherit);opacity:.88}
@media (max-width:767px){
  .pagecraft-timeline[data-orientation=horizontal]{display:flex;flex-direction:column;gap:var(--tl-gap,22px);padding-inline-start:42px}
  .pagecraft-timeline[data-orientation=horizontal]::before{inset-inline:auto;inset-inline-start:15px;inset-block:18px;inline-size:2px;block-size:auto}
  .pagecraft-timeline[data-orientation=horizontal] .pagecraft-timeline-mark{position:absolute;inset-inline-start:-41px;inset-block-start:16px;margin-block:0}
  .pagecraft-timeline[data-orientation=horizontal][data-marker=dots] .pagecraft-timeline-mark{inset-inline-start:-33px;inset-block-start:24px;margin-block:0}
}`;

export const PROGRESS_CSS = `.pagecraft-progress{display:flex;flex-direction:column;gap:var(--pg-gap,16px);width:100%}
.pagecraft-progress-item{display:flex;flex-direction:column;gap:7px}
.pagecraft-progress-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:14px;font-weight:600;color:var(--pg-text,inherit)}
.pagecraft-progress-label{margin:0;cursor:default}
.pagecraft-progress-val{font-variant-numeric:tabular-nums;font-size:13px;color:var(--pg-muted,inherit)}
progress.pagecraft-progress-bar{appearance:none;-webkit-appearance:none;border:0 solid;overflow:clip;display:block;width:100%;height:var(--pg-height,10px);border-radius:var(--pg-radius,999px);background:var(--pg-track,rgba(0,0,0,.12));color:var(--pg-fill,#18181b)}
progress.pagecraft-progress-bar::-webkit-progress-bar{background:transparent}
progress.pagecraft-progress-bar::-webkit-progress-value{background:var(--pg-fill,#18181b);border-radius:var(--pg-radius,999px);transition:inline-size .35s ease}
progress.pagecraft-progress-bar::-moz-progress-bar{background:var(--pg-fill,#18181b);border-radius:var(--pg-radius,999px);transition:inline-size .35s ease}
.pagecraft-progress[data-rounded="0"] progress.pagecraft-progress-bar{border-radius:2px}
.pagecraft-progress[data-rounded="0"] progress.pagecraft-progress-bar::-webkit-progress-value{border-radius:2px}
.pagecraft-progress[data-rounded="0"] progress.pagecraft-progress-bar::-moz-progress-bar{border-radius:2px}`;

export const HOTSPOT_CSS = `.pagecraft-hotspot{position:relative;width:100%}
.pagecraft-hotspot-stage{position:relative;width:100%;overflow:clip;border-radius:var(--hs-radius,12px);background:var(--c-surface,#f3f4f6)}
.pagecraft-hotspot-img{display:block;width:100%;height:auto;object-fit:cover}
.pagecraft-hotspot-stage[data-fixed-ratio] .pagecraft-hotspot-img{height:100%}
.pagecraft-hotspot-pin{position:absolute;transform:translate(-50%,-50%);min-width:28px;height:28px;padding:0 8px;border-radius:999px;border:2px solid var(--hs-ring,#fff);background:var(--hs-pin,#18181b);color:var(--hs-pin-ink,#fff);font:700 11px/1 inherit;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.34);z-index:2;transition:transform .16s ease,background-color .16s ease}
.pagecraft-hotspot-pin:hover,.pagecraft-hotspot-pin[aria-expanded="true"]{transform:translate(-50%,-50%) scale(1.12)}
.pagecraft-hotspot-pin:focus-visible{outline:3px solid var(--hs-pin,#18181b);outline-offset:3px}
.pagecraft-hotspot[data-hotspot-edit] .pagecraft-hotspot-pin{pointer-events:none}
.pagecraft-hotspot-card{position:fixed;inset:auto;margin:0;padding:14px 16px;inline-size:min(280px,calc(100dvw - 32px));border-radius:10px;border:1px solid var(--hs-line,rgba(0,0,0,.14));background:var(--hs-card,#fff);color:var(--hs-card-ink,#111311);box-shadow:0 16px 40px rgba(0,0,0,.24);z-index:60;opacity:0;translate:0 6px;transition:opacity .18s ease,translate .18s ease,display .18s ease,overlay .18s ease;transition-behavior:allow-discrete}
@supports (position-area:block-end){
  .pagecraft-hotspot-card{height:auto;margin-block:8px;position-area:block-end span-inline-end;position-try-fallbacks:flip-block,flip-inline}
}
.pagecraft-hotspot-card:not(:is(:popover-open,.\:popover-open)){display:none}
.pagecraft-hotspot-card:is(:popover-open,.\:popover-open){display:block;opacity:1;translate:0 0}
@starting-style{.pagecraft-hotspot-card:is(:popover-open,.\:popover-open){opacity:0;translate:0 6px}}
.pagecraft-hotspot-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px}
.pagecraft-hotspot-card-head strong{font-size:14px;line-height:1.3;font-weight:700}
.pagecraft-hotspot-close{appearance:none;border:0;background:transparent;color:inherit;opacity:.65;cursor:pointer;padding:2px 6px;font:600 16px/1 inherit;border-radius:4px}
.pagecraft-hotspot-close:hover{opacity:1}
.pagecraft-hotspot-card-body{margin:0;font-size:13px;line-height:1.5;opacity:.86}
@media (prefers-reduced-motion:reduce){.pagecraft-hotspot-pin,.pagecraft-hotspot-card{transition:none}}`;

export const HOTSPOT_JS = `<script>
(function(){
  var disposers=[];
  var nativePopover=Object.hasOwn(HTMLElement.prototype,'popover');
  var hasAnchor=typeof CSS!=='undefined'&&CSS.supports&&CSS.supports('position-area','block-end');
  function placeFallback(pin,card){
    var r=pin.getBoundingClientRect();
    var w=card.offsetWidth||260;
    var h=card.offsetHeight||120;
    var left=Math.max(12,Math.min(window.innerWidth-w-12,r.left+r.width/2-w/2));
    var top=r.bottom+8;
    if(top+h>window.innerHeight-12&&r.top-h-8>12)top=r.top-h-8;
    card.style.left=left+'px';
    card.style.top=Math.max(12,top)+'px';
  }
  document.querySelectorAll('.pagecraft-hotspot[data-hotspot]').forEach(function(root){
    if(root.hasAttribute('data-pc-hs-ready')||root.hasAttribute('data-hotspot-edit'))return;
    root.setAttribute('data-pc-hs-ready','');
    var offs=[];
    root.querySelectorAll('.pagecraft-hotspot-card[id]').forEach(function(card){
      var pin=root.querySelector('.pagecraft-hotspot-pin[popovertarget="'+card.id+'"]');
      if(!pin)return;
      if(nativePopover){
        function onToggle(e){
          var open=e.newState==='open';
          pin.setAttribute('aria-expanded',open?'true':'false');
          if(open&&!hasAnchor)placeFallback(pin,card);
        }
        card.addEventListener('toggle',onToggle);
        offs.push(function(){card.removeEventListener('toggle',onToggle);});
      }else{
        function close(){card.classList.remove(':popover-open');pin.setAttribute('aria-expanded','false');}
        function onPin(){
          var was=card.classList.contains(':popover-open');
          root.querySelectorAll('.pagecraft-hotspot-card').forEach(function(c){c.classList.remove(':popover-open');});
          root.querySelectorAll('.pagecraft-hotspot-pin').forEach(function(p){p.setAttribute('aria-expanded','false');});
          if(!was){card.classList.add(':popover-open');pin.setAttribute('aria-expanded','true');placeFallback(pin,card);}
        }
        var clsBtn=card.querySelector('.pagecraft-hotspot-close');
        pin.addEventListener('click',onPin);
        if(clsBtn)clsBtn.addEventListener('click',close);
        offs.push(function(){pin.removeEventListener('click',onPin);if(clsBtn)clsBtn.removeEventListener('click',close);close();});
      }
    });
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-hs-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
</script>
`;

export const STRIPS_CSS = `.pagecraft-strips{display:flex;gap:var(--st-gap,10px);height:var(--st-height,520px);width:100%}
.pagecraft-strip{position:relative;flex:1 1 0;min-width:0;border:0;padding:0;margin:0;border-radius:var(--st-radius,14px);overflow:hidden;cursor:pointer;text-align:left;background:var(--st-bg,#16191d);color:var(--st-ink,#fff);font-family:inherit;display:block;transition:flex-grow .55s cubic-bezier(.22,1,.36,1)}
.pagecraft-strip[aria-expanded="true"]{flex-grow:4.6}
.pagecraft-strip:focus-visible{outline:3px solid var(--st-accent,#A84404);outline-offset:3px}
.pagecraft-strips[data-strips-edit] .pagecraft-strip{pointer-events:none}
.pagecraft-strip-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;filter:brightness(.74);transition:transform .7s cubic-bezier(.22,1,.36,1),filter .45s ease}
.pagecraft-strip[aria-expanded="true"] .pagecraft-strip-img{filter:brightness(.94);transform:scale(1.02)}
.pagecraft-strip-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,16,20,.12) 0%,rgba(14,16,20,.36) 48%,rgba(14,16,20,.90) 100%);pointer-events:none}
.pagecraft-strip-body{position:absolute;inset-inline:0;inset-block-end:0;padding:24px 26px;display:flex;flex-direction:column;gap:8px;z-index:2;align-items:flex-start}
.pagecraft-strip-title{display:block;font-weight:600;color:var(--st-ink,#fff)}
.pagecraft-strip[aria-expanded="false"] .pagecraft-strip-title{align-self:center;writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;font-size:17px;line-height:1.2;letter-spacing:.02em;opacity:.92}
.pagecraft-strip[aria-expanded="true"] .pagecraft-strip-title{writing-mode:horizontal-tb;transform:none;white-space:normal;font-size:clamp(22px,2.3vw,30px);line-height:1.15;letter-spacing:-.01em}
.pagecraft-strip-detail{display:block;margin:0;color:var(--st-ink,#fff);opacity:.92;font-size:15px;line-height:1.55;max-width:48ch;font-weight:400}
.pagecraft-strip-tag{display:inline-block;margin-top:4px;font-size:12px;font-weight:600;letter-spacing:.05em;color:var(--st-tag,#F7B084)}
.pagecraft-strip[aria-expanded="false"] .pagecraft-strip-detail,.pagecraft-strip[aria-expanded="false"] .pagecraft-strip-tag{display:none}
@media (max-width:768px){
  .pagecraft-strips{flex-direction:column;height:auto;gap:10px}
  .pagecraft-strip{flex:none;height:108px;width:100%}
  .pagecraft-strip[aria-expanded="true"]{height:340px;flex-grow:0}
  .pagecraft-strip-body{padding:18px 20px}
  .pagecraft-strip[aria-expanded="false"] .pagecraft-strip-title{align-self:flex-start;writing-mode:horizontal-tb;transform:none;white-space:normal;font-size:19px}
  .pagecraft-strip[aria-expanded="true"] .pagecraft-strip-title{font-size:22px}
}
@media (prefers-reduced-motion:reduce){.pagecraft-strip,.pagecraft-strip-img{transition:none}}`;

export const STRIPS_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-strips[data-strips]').forEach(function(root){
    if(root.hasAttribute('data-pc-st-ready')||root.hasAttribute('data-strips-edit'))return;
    root.setAttribute('data-pc-st-ready','1');
    var strips=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-strip'));
    if(!strips.length)return;
    function activate(target){
      strips.forEach(function(btn){
        btn.setAttribute('aria-expanded',btn===target?'true':'false');
      });
    }
    var offs=[];
    strips.forEach(function(btn,idx){
      function onClick(){activate(btn);}
      function onKey(e){
        var next=-1;
        if(e.key==='ArrowRight'||e.key==='ArrowDown')next=(idx+1)%strips.length;
        else if(e.key==='ArrowLeft'||e.key==='ArrowUp')next=(idx-1+strips.length)%strips.length;
        else if(e.key==='Home')next=0;
        else if(e.key==='End')next=strips.length-1;
        if(next<0)return;
        e.preventDefault();
        strips[next].focus();
        activate(strips[next]);
      }
      btn.addEventListener('click',onClick);
      btn.addEventListener('keydown',onKey);
      offs.push(function(){btn.removeEventListener('click',onClick);btn.removeEventListener('keydown',onKey);});
    });
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-st-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
</script>
`;

export const SWITCHER_CSS = `.pagecraft-switcher{display:grid;grid-template-columns:minmax(0,.92fr) minmax(0,1.25fr);gap:var(--sw-gap,36px);align-items:start;width:100%}
.pagecraft-switcher[data-layout="tabs"]{grid-template-columns:minmax(0,1fr);gap:24px}
.pagecraft-switcher-list{display:flex;flex-direction:column;border-top:1px solid var(--sw-line,rgba(0,0,0,.14))}
.pagecraft-switcher[data-layout="tabs"] .pagecraft-switcher-list{flex-direction:row;flex-wrap:wrap;gap:8px;border-top:0;border-bottom:1px solid var(--sw-line,rgba(0,0,0,.14));padding-bottom:14px}
.pagecraft-switcher-tab{appearance:none;width:100%;border:0;border-bottom:1px solid var(--sw-line,rgba(0,0,0,.14));border-left:3px solid transparent;padding:20px 18px 20px 20px;margin:0;background:transparent;color:var(--sw-ink,#181A1D);font-family:inherit;text-align:left;display:flex;flex-direction:column;gap:6px;cursor:pointer;transition:background-color .2s ease,border-color .2s ease}
.pagecraft-switcher-tab:hover{background:rgba(24,26,29,.03)}
.pagecraft-switcher-tab[aria-selected="true"]{background:var(--sw-active-bg,rgba(168,68,4,.06));border-left-color:var(--sw-accent,#A84404)}
.pagecraft-switcher-tab:focus-visible{outline:2px solid var(--sw-accent,#A84404);outline-offset:-2px}
.pagecraft-switcher[data-switcher-edit] .pagecraft-switcher-tab{pointer-events:none}
.pagecraft-switcher[data-layout="tabs"] .pagecraft-switcher-tab{width:auto;border:1px solid var(--sw-line,rgba(0,0,0,.14));border-radius:999px;padding:10px 18px;gap:2px}
.pagecraft-switcher[data-layout="tabs"] .pagecraft-switcher-tab[aria-selected="true"]{background:var(--sw-accent,#A84404);border-color:var(--sw-accent,#A84404);color:#fff}
.pagecraft-switcher[data-layout="tabs"] .pagecraft-switcher-tab[aria-selected="true"] .pagecraft-switcher-tab-meta{color:rgba(255,255,255,.86)}
.pagecraft-switcher-tab-title{display:block;font-size:18px;line-height:1.25;font-weight:600;color:inherit}
.pagecraft-switcher-tab-meta{display:block;font-size:13px;line-height:1.35;font-weight:500;color:var(--sw-muted,#52565E)}
.pagecraft-switcher-tab-detail{display:block;margin-top:4px;font-size:14.5px;line-height:1.58;color:var(--sw-muted,#52565E);font-weight:400}
.pagecraft-switcher-tab[aria-selected="false"] .pagecraft-switcher-tab-detail,.pagecraft-switcher[data-layout="tabs"] .pagecraft-switcher-tab-detail{display:none}
.pagecraft-switcher-stage{display:grid;border-radius:var(--sw-radius,14px);overflow:hidden;border:1px solid var(--sw-line,rgba(0,0,0,.14));background:var(--sw-surface,#fff)}
.pagecraft-switcher-panel{grid-area:1 / 1;margin:0;display:flex;flex-direction:column;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .28s ease,visibility .28s ease}
.pagecraft-switcher-panel[data-active="1"]{opacity:1;visibility:visible;pointer-events:auto;z-index:1}
.pagecraft-switcher-img{display:block;width:100%;height:auto;aspect-ratio:var(--sw-ratio,3 / 2);object-fit:cover;background:#16191d}
.pagecraft-switcher-cap{padding:18px 22px;display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--sw-line,rgba(0,0,0,.12));background:var(--sw-surface,#fff)}
.pagecraft-switcher-cap-title{display:block;font-size:16px;line-height:1.3;font-weight:600;color:var(--sw-ink,#181A1D)}
.pagecraft-switcher-cap-text{margin:0;font-size:14px;line-height:1.55;color:var(--sw-muted,#52565E)}
@media (max-width:860px){
  .pagecraft-switcher{grid-template-columns:minmax(0,1fr);gap:20px}
  .pagecraft-switcher-tab{padding:16px}
  .pagecraft-switcher-cap{padding:16px 18px}
}
@media (prefers-reduced-motion:reduce){.pagecraft-switcher-tab,.pagecraft-switcher-panel{transition:none}}`;

export const SWITCHER_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-switcher[data-switcher]').forEach(function(root){
    if(root.hasAttribute('data-pc-sw-ready')||root.hasAttribute('data-switcher-edit'))return;
    root.setAttribute('data-pc-sw-ready','1');
    var tabs=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-switcher-tab[role="tab"]'));
    var panels=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-switcher-panel[role="tabpanel"]'));
    if(!tabs.length||!panels.length)return;
    function activate(idx){
      tabs.forEach(function(tab,i){
        var active=i===idx;
        tab.setAttribute('aria-selected',active?'true':'false');
        tab.setAttribute('tabindex',active?'0':'-1');
      });
      panels.forEach(function(panel,i){
        var active=i===idx;
        panel.setAttribute('data-active',active?'1':'0');
        panel.setAttribute('aria-hidden',active?'false':'true');
      });
    }
    var offs=[];
    tabs.forEach(function(tab,idx){
      function onClick(){activate(idx);}
      function onKey(e){
        var next=-1;
        if(e.key==='ArrowDown'||e.key==='ArrowRight')next=(idx+1)%tabs.length;
        else if(e.key==='ArrowUp'||e.key==='ArrowLeft')next=(idx-1+tabs.length)%tabs.length;
        else if(e.key==='Home')next=0;
        else if(e.key==='End')next=tabs.length-1;
        if(next<0)return;
        e.preventDefault();
        tabs[next].focus();
        activate(next);
      }
      tab.addEventListener('click',onClick);
      tab.addEventListener('keydown',onKey);
      offs.push(function(){tab.removeEventListener('click',onClick);tab.removeEventListener('keydown',onKey);});
    });
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-sw-ready');
    });
  });
  if(disposers.length&&typeof window.__pagecraftRegisterPreviewDispose==='function'){
    window.__pagecraftRegisterPreviewDispose(function(){
      disposers.forEach(function(dispose){dispose();});
    });
  }
})();
</script>
`;
