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

export const EXHIBIT_CSS = `.pagecraft-exhibit{position:relative;width:100%}
.pagecraft-exhibit-list{list-style:none;margin:0;padding:0;border-top:1px solid var(--ex-line,rgba(19,49,40,.15))}
.pagecraft-exhibit-item{margin:0;border-bottom:1px solid var(--ex-line,rgba(19,49,40,.15))}
.pagecraft-exhibit-row{appearance:none;width:100%;border:0;background:transparent;padding:20px 14px;margin:0;display:grid;grid-template-columns:72px minmax(0,1.4fr) minmax(0,1fr) auto auto;align-items:center;gap:22px;text-align:left;text-decoration:none;color:var(--ex-ink,#132A22);font-family:inherit;cursor:pointer;transition:background-color .22s cubic-bezier(.22,1,.36,1),padding-inline-start .22s cubic-bezier(.22,1,.36,1)}
.pagecraft-exhibit-row:hover,.pagecraft-exhibit-row:focus-visible,.pagecraft-exhibit-row[data-active="1"]{background:var(--ex-hover,rgba(19,49,40,.045));padding-inline-start:20px}
.pagecraft-exhibit-row:focus-visible{outline:2px solid var(--ex-accent,#0F6A53);outline-offset:-2px}
.pagecraft-exhibit[data-exhibit-edit] .pagecraft-exhibit-row{pointer-events:none}
.pagecraft-exhibit-thumb{display:block;width:72px;border-radius:7px;overflow:hidden;border:1px solid var(--ex-line,rgba(19,49,40,.15));background:#133128;flex-shrink:0}
.pagecraft-exhibit-thumb-img{display:block;width:100%;height:auto;aspect-ratio:4 / 3;object-fit:cover}
.pagecraft-exhibit-main{display:flex;flex-direction:column;gap:3px;min-width:0}
.pagecraft-exhibit-title{display:block;font-size:clamp(19px,1.9vw,24px);line-height:1.32;font-weight:600;letter-spacing:-.012em;color:var(--ex-ink,#132A22)}
.pagecraft-exhibit-loc{display:block;font-size:13.5px;line-height:1.4;color:var(--ex-muted,#435A51)}
.pagecraft-exhibit-scope{display:block;font-size:14px;line-height:1.45;color:var(--ex-muted,#435A51)}
.pagecraft-exhibit-year{display:block;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ex-ink,#132A22);white-space:nowrap}
.pagecraft-exhibit-arrow{color:var(--ex-accent,#0F6A53);opacity:.72;flex-shrink:0;transition:transform .22s cubic-bezier(.22,1,.36,1),opacity .22s ease}
.pagecraft-exhibit-row:hover .pagecraft-exhibit-arrow,.pagecraft-exhibit-row:focus-visible .pagecraft-exhibit-arrow{opacity:1;transform:translate(2px,-2px)}
.pagecraft-exhibit-float{position:absolute;inset-inline-end:52px;inset-block-start:0;width:276px;aspect-ratio:var(--ex-ratio,4 / 3);border-radius:var(--ex-radius,12px);overflow:hidden;border:1px solid var(--ex-line,rgba(19,49,40,.18));background-color:var(--ex-surface,#133128);background-size:cover;background-position:center;box-shadow:0 20px 48px rgba(14,30,24,.22);pointer-events:none;z-index:20;opacity:0;visibility:hidden;transform:translate3d(0,var(--ex-y,12px),0) scale(.96);transition:opacity .24s cubic-bezier(.22,1,.36,1),visibility .24s ease,transform .28s cubic-bezier(.22,1,.36,1)}
.pagecraft-exhibit-float[data-open="1"]{opacity:1;visibility:visible;transform:translate3d(0,var(--ex-y,12px),0) scale(1)}
@media (max-width:860px){
  .pagecraft-exhibit-row{grid-template-columns:64px minmax(0,1fr) auto;gap:12px 14px;padding:16px 8px}
  .pagecraft-exhibit-row:hover,.pagecraft-exhibit-row:focus-visible,.pagecraft-exhibit-row[data-active="1"]{padding-inline-start:10px}
  .pagecraft-exhibit-thumb{width:64px}
  .pagecraft-exhibit-scope{grid-column:2 / -1;font-size:13px}
  .pagecraft-exhibit-arrow{display:none}
  .pagecraft-exhibit-float{opacity:0!important;visibility:hidden!important}
}
@media (prefers-reduced-motion:reduce){.pagecraft-exhibit-row,.pagecraft-exhibit-arrow,.pagecraft-exhibit-float{transition:none}}`;

export const EXHIBIT_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-exhibit[data-exhibit]').forEach(function(root){
    if(root.hasAttribute('data-pc-ex-ready')||root.hasAttribute('data-exhibit-edit'))return;
    root.setAttribute('data-pc-ex-ready','1');
    var rows=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-exhibit-row[data-exhibit-idx]'));
    var floatEl=root.querySelector('.pagecraft-exhibit-float');
    if(!rows.length||!floatEl)return;
    function show(idx,row){
      rows.forEach(function(r,i){r.setAttribute('data-active',i===idx?'1':'0');});
      var img=row.querySelector('.pagecraft-exhibit-thumb-img');
      var src=img&&(img.currentSrc||img.getAttribute('src'))||'';
      if(src){
        floatEl.style.backgroundImage='url("'+src.replace(/"/g,'\\"')+'")';
        floatEl.setAttribute('data-active-idx',String(idx));
      }
      var rootRect=root.getBoundingClientRect();
      var rowRect=row.getBoundingClientRect();
      var fh=floatEl.offsetHeight||207;
      var maxTop=Math.max(0,(rootRect.height||320)-fh);
      var y=Math.max(0,Math.min(maxTop,(rowRect.top-rootRect.top)+(rowRect.height/2)-(fh/2)));
      floatEl.style.setProperty('--ex-y',Math.round(y)+'px');
      floatEl.setAttribute('data-open','1');
    }
    function hide(){
      rows.forEach(function(r){r.removeAttribute('data-active');});
      floatEl.setAttribute('data-open','0');
    }
    var offs=[];
    rows.forEach(function(row,idx){
      function onEnter(){show(idx,row);}
      function onFocus(){show(idx,row);}
      row.addEventListener('pointerenter',onEnter);
      row.addEventListener('focus',onFocus);
      offs.push(function(){row.removeEventListener('pointerenter',onEnter);row.removeEventListener('focus',onFocus);});
    });
    function onLeave(){hide();}
    function onFocusOut(e){if(!root.contains(e.relatedTarget))hide();}
    root.addEventListener('pointerleave',onLeave);
    root.addEventListener('focusout',onFocusOut);
    offs.push(function(){root.removeEventListener('pointerleave',onLeave);root.removeEventListener('focusout',onFocusOut);});
    disposers.push(function(){
      offs.forEach(function(off){off();});
      hide();
      root.removeAttribute('data-pc-ex-ready');
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

export const SCROLLY_CSS = `.pagecraft-scrolly{display:grid;grid-template-columns:minmax(0,.96fr) minmax(0,1.08fr);gap:var(--sc-gap,44px);align-items:start;width:100%;position:relative}
.pagecraft-scrolly-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:24px}
.pagecraft-scrolly-step{margin:0;outline:none;cursor:pointer}
.pagecraft-scrolly[data-scrolly-edit] .pagecraft-scrolly-step{pointer-events:none}
.pagecraft-scrolly-card{padding:28px 30px;border-radius:var(--sc-radius,14px);border:1px solid var(--sc-line,rgba(19,49,40,.15));background:var(--sc-surface,#fff);display:flex;flex-direction:column;gap:12px;transition:border-color .25s ease,background-color .25s ease,box-shadow .25s ease}
.pagecraft-scrolly-step[data-active="1"] .pagecraft-scrolly-card{border-color:var(--sc-accent,#0F6A53);box-shadow:0 16px 38px rgba(14,32,25,.09)}
.pagecraft-scrolly-step:focus-visible .pagecraft-scrolly-card{outline:2px solid var(--sc-accent,#0F6A53);outline-offset:2px}
.pagecraft-scrolly-title{margin:0;font-size:clamp(20px,2vw,25px);line-height:1.22;font-weight:600;letter-spacing:-.012em;color:var(--sc-ink,#132A22)}
.pagecraft-scrolly-detail{margin:0;font-size:15.5px;line-height:1.62;color:var(--sc-muted,#435A51)}
.pagecraft-scrolly-fact{align-self:flex-start;margin-top:4px;padding:5px 12px;border-radius:999px;border:1px solid var(--sc-line,rgba(19,49,40,.16));font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--sc-accent,#0F6A53);background:rgba(15,106,83,.06)}
.pagecraft-scrolly-stage{position:sticky;top:108px}
.pagecraft-scrolly-frame{display:grid;border-radius:var(--sc-radius,14px);overflow:hidden;border:1px solid var(--sc-line,rgba(19,49,40,.16));background:var(--sc-surface,#fff);box-shadow:0 20px 48px rgba(14,32,25,.12)}
.pagecraft-scrolly-plate{grid-area:1 / 1;margin:0;display:flex;flex-direction:column;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .38s cubic-bezier(.22,1,.36,1),visibility .38s ease}
.pagecraft-scrolly-plate[data-active="1"]{opacity:1;visibility:visible;pointer-events:auto;z-index:1}
.pagecraft-scrolly-img{display:block;width:100%;height:auto;aspect-ratio:var(--sc-ratio,4 / 3);object-fit:cover;background:#133128;transform:scale(1.03);transition:transform .55s cubic-bezier(.22,1,.36,1)}
.pagecraft-scrolly-plate[data-active="1"] .pagecraft-scrolly-img{transform:scale(1)}
.pagecraft-scrolly-cap{padding:14px 20px;font-size:13.5px;line-height:1.45;font-weight:500;font-variant-numeric:tabular-nums;color:var(--sc-muted,#435A51);border-top:1px solid var(--sc-line,rgba(19,49,40,.12));background:var(--sc-surface,#fff)}
@media (max-width:860px){
  .pagecraft-scrolly{grid-template-columns:minmax(0,1fr);gap:20px}
  .pagecraft-scrolly-stage{position:relative;top:auto;order:-1}
  .pagecraft-scrolly-card{padding:20px}
  .pagecraft-scrolly-steps{gap:14px}
}
@media (prefers-reduced-motion:reduce){.pagecraft-scrolly-card,.pagecraft-scrolly-plate,.pagecraft-scrolly-img{transition:none}}`;

export const SCROLLY_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-scrolly[data-scrolly]').forEach(function(root){
    if(root.hasAttribute('data-pc-sc-ready')||root.hasAttribute('data-scrolly-edit'))return;
    root.setAttribute('data-pc-sc-ready','1');
    var steps=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-scrolly-step[data-scrolly-step]'));
    var plates=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-scrolly-plate[data-scrolly-plate]'));
    if(!steps.length||!plates.length)return;
    function activate(idx){
      steps.forEach(function(s,i){s.setAttribute('data-active',i===idx?'1':'0');});
      plates.forEach(function(p,i){
        var on=i===idx;
        p.setAttribute('data-active',on?'1':'0');
        p.setAttribute('aria-hidden',on?'false':'true');
      });
    }
    var offs=[];
    steps.forEach(function(step,idx){
      function onAct(){activate(idx);}
      function onKey(e){
        if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(idx);}
      }
      step.addEventListener('click',onAct);
      step.addEventListener('focus',onAct);
      step.addEventListener('keydown',onKey);
      offs.push(function(){
        step.removeEventListener('click',onAct);
        step.removeEventListener('focus',onAct);
        step.removeEventListener('keydown',onKey);
      });
    });
    if(typeof IntersectionObserver==='function'){
      var io=new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(!entry.isIntersecting)return;
          var idx=parseInt(entry.target.getAttribute('data-scrolly-step')||'0',10);
          if(idx>=0)activate(idx);
        });
      },{rootMargin:'-28% 0px -42% 0px',threshold:0.05});
      steps.forEach(function(step){io.observe(step);});
      offs.push(function(){io.disconnect();});
    }
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-sc-ready');
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

export const CLOCKS_CSS = `.pagecraft-clocks{width:100%}
.pagecraft-clocks-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--ck-min,240px)),1fr));gap:var(--ck-gap,0px);border-top:var(--ck-rule,2px) solid var(--ck-ink,#0C0F1A)}
.pagecraft-clocks-card{margin:0;display:flex;flex-direction:column;gap:14px;padding:24px var(--ck-pad,24px) 26px;background:var(--ck-surface,transparent);border-radius:var(--ck-radius,0px);border-bottom:1px solid var(--ck-line,#CDD2DC)}
.pagecraft-clocks-card+.pagecraft-clocks-card{border-inline-start:1px solid var(--ck-line,#CDD2DC)}
.pagecraft-clocks-media{display:block;width:100%;border-radius:var(--ck-img-radius,4px);overflow:hidden;border:1px solid var(--ck-line,#CDD2DC);margin-bottom:4px}
.pagecraft-clocks-img{display:block;width:100%;height:auto;aspect-ratio:4 / 3;object-fit:cover}
.pagecraft-clocks-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
.pagecraft-clocks-city{font-size:var(--ck-city-size,22px);line-height:1.15;font-weight:600;letter-spacing:-.01em;color:var(--ck-ink,#0C0F1A)}
.pagecraft-clocks-time{font-size:var(--ck-time-size,40px);line-height:1;font-weight:500;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--ck-ink,#0C0F1A);white-space:nowrap}
.pagecraft-clocks-state{display:inline-flex;align-items:center;gap:8px;font-size:13px;line-height:1.3;font-weight:600;color:var(--ck-muted,#525A6B)}
.pagecraft-clocks-state::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--ck-line,#CDD2DC);flex-shrink:0}
.pagecraft-clocks-state[data-open="1"]{color:var(--ck-accent,#1B36B8)}
.pagecraft-clocks-state[data-open="1"]::before{background:var(--ck-accent,#1B36B8);box-shadow:0 0 0 3px color-mix(in srgb,var(--ck-accent,#1B36B8) 18%,transparent)}
.pagecraft-clocks-addr{margin:0;font-size:15px;line-height:1.55;color:var(--ck-muted,#525A6B);font-style:normal}
.pagecraft-clocks-links{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:auto;padding-top:4px}
.pagecraft-clocks-link{font-size:14px;font-weight:600;line-height:1.4;color:var(--ck-ink,#0C0F1A);text-decoration:underline;text-decoration-color:var(--ck-line,#CDD2DC);text-underline-offset:4px;text-decoration-thickness:1px;transition:text-decoration-color .18s ease,color .18s ease}
.pagecraft-clocks-link:hover,.pagecraft-clocks-link:focus-visible{color:var(--ck-accent,#1B36B8);text-decoration-color:currentColor}
.pagecraft-clocks-link:focus-visible{outline:2px solid var(--ck-accent,#1B36B8);outline-offset:3px;border-radius:2px}
@media (max-width:860px){
  .pagecraft-clocks-card+.pagecraft-clocks-card{border-inline-start:0}
  .pagecraft-clocks-card{padding:20px var(--ck-pad-m,20px) 22px}
  .pagecraft-clocks-time{font-size:min(var(--ck-time-size,40px),34px)}
}
@media (prefers-reduced-motion:reduce){.pagecraft-clocks-link{transition:none}}`;

export const CLOCKS_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-clocks[data-clocks]').forEach(function(root){
    if(root.hasAttribute('data-pc-ck-ready'))return;
    root.setAttribute('data-pc-ck-ready','1');
    var cards=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-clocks-card[data-tz]'));
    if(!cards.length)return;
    var h12=root.getAttribute('data-hour12')==='1';
    var opens=parseFloat(root.getAttribute('data-opens')||'9');
    var closes=parseFloat(root.getAttribute('data-closes')||'18');
    var openLabel=root.getAttribute('data-open-label')||'Open now';
    var closedLabel=root.getAttribute('data-closed-label')||'Closed';
    function tick(){
      var now=new Date();
      cards.forEach(function(card){
        var tz=card.getAttribute('data-tz')||'';
        var timeEl=card.querySelector('[data-clocks-time]');
        var stateEl=card.querySelector('[data-clocks-state]');
        try{
          var parts=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',weekday:'short',hour12:false}).formatToParts(now);
          var get=function(t){for(var i=0;i<parts.length;i++){if(parts[i].type===t)return parts[i].value;}return '';};
          var hh=parseInt(get('hour'),10)%24;var mm=parseInt(get('minute'),10);var wd=get('weekday');
          if(timeEl){
            timeEl.textContent=new Intl.DateTimeFormat(h12?'en-US':'en-GB',{timeZone:tz,hour:h12?'numeric':'2-digit',minute:'2-digit',hour12:h12}).format(now);
            timeEl.setAttribute('datetime',now.toISOString());
          }
          if(stateEl){
            var dec=hh+mm/60;var weekend=wd==='Sat'||wd==='Sun';
            var isOpen=!weekend&&dec>=opens&&dec<closes;
            stateEl.setAttribute('data-open',isOpen?'1':'0');
            stateEl.textContent=isOpen?openLabel:closedLabel;
          }
        }catch(err){
          if(timeEl)timeEl.textContent='--:--';
        }
      });
    }
    tick();
    var timer=setInterval(tick,15000);
    function onVis(){if(!document.hidden)tick();}
    document.addEventListener('visibilitychange',onVis);
    disposers.push(function(){
      clearInterval(timer);
      document.removeEventListener('visibilitychange',onVis);
      root.removeAttribute('data-pc-ck-ready');
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

export const ROSTER_CSS = `.pagecraft-roster{width:100%;display:flex;flex-direction:column;gap:20px}
.pagecraft-roster-stage{display:grid;background:var(--rs-surface,#FFFFFF);border:1px solid var(--rs-line,#C8D0DF);border-radius:var(--rs-radius,2px);overflow:hidden}
.pagecraft-roster-panel{grid-area:1 / 1;display:grid;grid-template-columns:minmax(0,.42fr) minmax(0,.58fr);align-items:stretch;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .26s cubic-bezier(.22,1,.36,1),visibility .26s ease}
.pagecraft-roster-panel[data-active="1"]{opacity:1;visibility:visible;pointer-events:auto}
.pagecraft-roster-media{background:var(--rs-ink,#0C1220);overflow:hidden}
.pagecraft-roster-img{display:block;width:100%;height:100%;min-height:340px;aspect-ratio:var(--rs-ratio,4 / 5);object-fit:cover;object-position:center top}
.pagecraft-roster-body{padding:36px 40px;display:flex;flex-direction:column;justify-content:space-between;gap:22px}
.pagecraft-roster-head{display:flex;flex-direction:column;gap:8px}
.pagecraft-roster-name{margin:0;font-size:clamp(26px,2.5vw,34px);line-height:1.2;font-weight:600;letter-spacing:-.016em;color:var(--rs-ink,#0C1220)}
.pagecraft-roster-role{margin:0;font-size:16px;line-height:1.5;font-weight:500;color:var(--rs-accent,#1B3B9B)}
.pagecraft-roster-meta{display:flex;flex-wrap:wrap;gap:8px 24px;padding-top:14px;border-top:1px solid var(--rs-line,#C8D0DF);font-size:14px;line-height:1.5;color:var(--rs-muted,#4A566E)}
.pagecraft-roster-meta strong{color:var(--rs-ink,#0C1220);font-weight:600}
.pagecraft-roster-quote{margin:0;padding-top:18px;border-top:1px solid var(--rs-line,#C8D0DF);font-size:17px;line-height:1.6;color:var(--rs-ink,#0C1220);max-width:56ch}
.pagecraft-roster-cta{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;line-height:1.4;color:var(--rs-accent,#1B3B9B);text-decoration:underline;text-underline-offset:4px}
.pagecraft-roster-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:12px}
.pagecraft-roster-tab{appearance:none;margin:0;padding:14px 16px;display:flex;align-items:center;gap:12px;text-align:left;background:var(--rs-surface,#FFFFFF);border:1px solid var(--rs-line,#C8D0DF);border-radius:var(--rs-radius,2px);color:var(--rs-ink,#0C1220);font-family:inherit;cursor:pointer;transition:border-color .18s ease,background-color .18s ease}
.pagecraft-roster-tab[aria-selected="true"]{border-color:var(--rs-accent,#1B3B9B);background:color-mix(in srgb,var(--rs-accent,#1B3B9B) 6%,var(--rs-surface,#FFFFFF))}
.pagecraft-roster-tab:focus-visible{outline:2px solid var(--rs-accent,#1B3B9B);outline-offset:2px}
.pagecraft-roster-avatar{width:42px;height:42px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;letter-spacing:.04em;background-color:var(--rs-ink,#0C1220);color:#FFFFFF;background-size:cover;background-position:center top}
.pagecraft-roster-avatar[data-has-photo="1"]{color:transparent}
.pagecraft-roster-tmeta{display:flex;flex-direction:column;gap:2px;min-width:0}
.pagecraft-roster-tname{font-size:14.5px;line-height:1.35;font-weight:600;color:var(--rs-ink,#0C1220)}
.pagecraft-roster-tseat{font-size:12.5px;line-height:1.35;color:var(--rs-muted,#4A566E)}
@media (max-width:860px){
  .pagecraft-roster-panel{grid-template-columns:1fr}
  .pagecraft-roster-img{height:auto;min-height:0;aspect-ratio:var(--rs-ratio,4 / 5)}
  .pagecraft-roster-body{padding:24px 20px}
}
@media (prefers-reduced-motion:reduce){.pagecraft-roster-panel,.pagecraft-roster-tab{transition:none}}`;

export const ROSTER_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-roster[data-roster]').forEach(function(root){
    if(root.hasAttribute('data-pc-rs-ready'))return;
    root.setAttribute('data-pc-rs-ready','1');
    var tabs=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-roster-tab[data-roster-tab]'));
    var panels=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-roster-panel[data-roster-panel]'));
    if(!tabs.length||!panels.length)return;
    panels.forEach(function(panel,i){
      var img=panel.querySelector('.pagecraft-roster-img');
      var av=tabs[i]&&tabs[i].querySelector('.pagecraft-roster-avatar');
      var src=img&&(img.currentSrc||img.getAttribute('src'))||'';
      if(av&&src&&src.indexOf('data:image/svg')!==0){
        av.style.backgroundImage='url("'+src.replace(/"/g,'\\"')+'")';
        av.setAttribute('data-has-photo','1');
      }
    });
    function select(idx,focusTab){
      tabs.forEach(function(t,i){
        var on=i===idx;
        t.setAttribute('aria-selected',on?'true':'false');
        t.setAttribute('tabindex',on?'0':'-1');
        if(on&&focusTab)t.focus();
      });
      panels.forEach(function(p,i){
        var on=i===idx;
        p.setAttribute('data-active',on?'1':'0');
        p.setAttribute('aria-hidden',on?'false':'true');
      });
    }
    var offs=[];
    tabs.forEach(function(tab,idx){
      function onClick(){select(idx,false);}
      function onKey(e){
        var n=tabs.length;
        if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();select((idx+1)%n,true);}
        else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();select((idx-1+n)%n,true);}
        else if(e.key==='Home'){e.preventDefault();select(0,true);}
        else if(e.key==='End'){e.preventDefault();select(n-1,true);}
      }
      tab.addEventListener('click',onClick);
      tab.addEventListener('keydown',onKey);
      offs.push(function(){
        tab.removeEventListener('click',onClick);
        tab.removeEventListener('keydown',onKey);
      });
    });
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-rs-ready');
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

export const TIERS_CSS = `.pagecraft-tiers{width:100%;display:flex;flex-direction:column;gap:24px}
.pagecraft-tiers-bar{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.pagecraft-tiers-cur-lbl{font-size:12.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--tr-muted,#4A566E);margin-right:4px}
.pagecraft-tiers-cur{appearance:none;margin:0;padding:8px 14px;font-family:inherit;font-size:13px;font-weight:600;line-height:1.3;border:1px solid var(--tr-line,#C8D0DF);border-radius:var(--tr-radius,2px);background:var(--tr-surface,#FFFFFF);color:var(--tr-ink,#0C1220);cursor:pointer;transition:background-color .16s ease,color .16s ease,border-color .16s ease}
.pagecraft-tiers-cur[aria-pressed="true"]{background:var(--tr-accent,#1B3B9B);border-color:var(--tr-accent,#1B3B9B);color:#FFFFFF}
.pagecraft-tiers-cur:focus-visible{outline:2px solid var(--tr-accent,#1B3B9B);outline-offset:2px}
.pagecraft-tiers-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:22px;align-items:stretch}
.pagecraft-tiers-card{padding:30px 28px;display:flex;flex-direction:column;gap:18px;background:var(--tr-surface,#FFFFFF);color:var(--tr-ink,#0C1220);border:1px solid var(--tr-line,#C8D0DF);border-radius:var(--tr-radius,2px)}
.pagecraft-tiers-card[data-featured="1"]{background:var(--tr-feat-bg,#0C1220);color:var(--tr-feat-ink,#F2F4F8);border-color:var(--tr-feat-bg,#0C1220)}
.pagecraft-tiers-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.pagecraft-tiers-name{margin:0;font-size:22px;line-height:1.3;font-weight:600;color:inherit}
.pagecraft-tiers-badge{padding:4px 10px;font-size:11.5px;line-height:1.3;font-weight:600;border-radius:2px;background:var(--tr-accent,#1B3B9B);color:#FFFFFF;white-space:nowrap}
.pagecraft-tiers-sum{margin:0;font-size:14.5px;line-height:1.58;color:var(--tr-muted,#4A566E);max-width:46ch}
.pagecraft-tiers-card[data-featured="1"] .pagecraft-tiers-sum{color:var(--tr-feat-muted,#B8C6E0)}
.pagecraft-tiers-price-row{display:flex;align-items:baseline;gap:8px;padding:16px 0;border-top:1px solid var(--tr-line,#C8D0DF);border-bottom:1px solid var(--tr-line,#C8D0DF)}
.pagecraft-tiers-card[data-featured="1"] .pagecraft-tiers-price-row{border-color:rgba(184,198,224,.22)}
.pagecraft-tiers-price{font-size:clamp(30px,3vw,38px);line-height:1.1;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:inherit}
.pagecraft-tiers-period{font-size:14px;line-height:1.4;color:var(--tr-muted,#4A566E)}
.pagecraft-tiers-card[data-featured="1"] .pagecraft-tiers-period{color:var(--tr-feat-muted,#B8C6E0)}
.pagecraft-tiers-feats{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;flex:1}
.pagecraft-tiers-feat{font-size:14px;line-height:1.5;display:flex;align-items:flex-start;gap:10px;color:inherit}
.pagecraft-tiers-check{color:var(--tr-accent,#1B3B9B);font-weight:700;flex-shrink:0}
.pagecraft-tiers-card[data-featured="1"] .pagecraft-tiers-check{color:#7DA2FF}
.pagecraft-tiers-btn{margin-top:6px;padding:12px 18px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;line-height:1.3;text-decoration:none;border-radius:var(--tr-radius,2px);border:1px solid var(--tr-ink,#0C1220);color:var(--tr-ink,#0C1220);background:transparent;transition:background-color .16s ease,color .16s ease}
.pagecraft-tiers-card[data-featured="1"] .pagecraft-tiers-btn{background:var(--tr-accent,#1B3B9B);border-color:var(--tr-accent,#1B3B9B);color:#FFFFFF}
.pagecraft-tiers-btn:hover,.pagecraft-tiers-btn:focus-visible{background:var(--tr-accent,#1B3B9B);border-color:var(--tr-accent,#1B3B9B);color:#FFFFFF}
@media (max-width:860px){.pagecraft-tiers-bar{justify-content:flex-start}.pagecraft-tiers-card{padding:24px 20px}}
@media (prefers-reduced-motion:reduce){.pagecraft-tiers-cur,.pagecraft-tiers-btn{transition:none}}`;

export const TIERS_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-tiers[data-tiers]').forEach(function(root){
    if(root.hasAttribute('data-pc-tr-ready'))return;
    root.setAttribute('data-pc-tr-ready','1');
    var btns=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-tiers-cur[data-tiers-cur]'));
    var prices=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-tiers-price[data-usd]'));
    if(!btns.length)return;
    function setCur(cur){
      root.setAttribute('data-active-cur',cur);
      btns.forEach(function(b){
        b.setAttribute('aria-pressed',b.getAttribute('data-tiers-cur')===cur?'true':'false');
      });
      prices.forEach(function(el){
        var val=el.getAttribute('data-'+cur)||el.getAttribute('data-usd')||'';
        if(val)el.textContent=val;
      });
    }
    var offs=[];
    btns.forEach(function(btn){
      function onClick(){setCur(btn.getAttribute('data-tiers-cur')||'usd');}
      btn.addEventListener('click',onClick);
      offs.push(function(){btn.removeEventListener('click',onClick);});
    });
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-tr-ready');
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

export const QAPILLS_CSS = `.pagecraft-qapills{width:100%;display:flex;flex-direction:column;gap:24px}
.pagecraft-qapills-bar{display:flex;flex-wrap:wrap;gap:10px;justify-content:var(--qp-align,center)}
.pagecraft-qapills-pill{appearance:none;margin:0;padding:10px 18px;min-height:42px;font-family:inherit;font-size:14px;font-weight:600;line-height:1.35;border:1px solid var(--qp-line,#C8D0DF);border-radius:var(--qp-pill-radius,999px);background:var(--qp-surface,#FFFFFF);color:var(--qp-ink,#0C1220);cursor:pointer;transition:background-color .16s ease,color .16s ease,border-color .16s ease}
.pagecraft-qapills-pill[aria-selected="true"]{background:var(--qp-accent,#1B3B9B);border-color:var(--qp-accent,#1B3B9B);color:#FFFFFF}
.pagecraft-qapills-pill:focus-visible{outline:2px solid var(--qp-accent,#1B3B9B);outline-offset:2px}
.pagecraft-qapills-stage{padding:36px 40px;background:var(--qp-surface,#FFFFFF);border:1px solid var(--qp-line,#C8D0DF);border-radius:var(--qp-radius,2px)}
.pagecraft-qapills-panel{display:flex;flex-direction:column;align-items:var(--qp-panel-align,center);text-align:var(--qp-text-align,center);gap:14px}
.pagecraft-qapills-panel[hidden]{display:none}
.pagecraft-qapills-q{margin:0;font-size:clamp(22px,2.2vw,28px);line-height:1.3;font-weight:600;color:var(--qp-ink,#0C1220);max-width:42ch}
.pagecraft-qapills-a{margin:0;font-size:16px;line-height:1.65;color:var(--qp-muted,#4A566E);max-width:60ch}
.pagecraft-qapills-note{font-size:13px;line-height:1.45;font-weight:600;color:var(--qp-ink,#0C1220);padding-top:6px}
.pagecraft-qapills-link{font-size:14px;font-weight:600;line-height:1.4;color:var(--qp-accent,#1B3B9B);text-decoration:underline;text-underline-offset:4px}
@media (max-width:860px){.pagecraft-qapills-stage{padding:24px 20px}.pagecraft-qapills-bar{justify-content:flex-start}}
@media (prefers-reduced-motion:reduce){.pagecraft-qapills-pill{transition:none}}`;

export const QAPILLS_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-qapills[data-qapills]').forEach(function(root){
    if(root.hasAttribute('data-pc-qp-ready'))return;
    root.setAttribute('data-pc-qp-ready','1');
    var pills=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-qapills-pill[data-qa-idx]'));
    var panels=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-qapills-panel[data-qa-panel]'));
    if(!pills.length||!panels.length)return;
    function activate(idx,focusPill){
      pills.forEach(function(p,i){
        var on=i===idx;
        p.setAttribute('aria-selected',on?'true':'false');
        p.setAttribute('tabindex',on?'0':'-1');
        if(on&&focusPill)p.focus();
      });
      panels.forEach(function(pn,i){
        if(i===idx)pn.removeAttribute('hidden');
        else pn.setAttribute('hidden','');
      });
    }
    var offs=[];
    pills.forEach(function(pill,idx){
      function onClick(){activate(idx,false);}
      function onKey(e){
        var n=pills.length;
        if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();activate((idx+1)%n,true);}
        else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();activate((idx-1+n)%n,true);}
        else if(e.key==='Home'){e.preventDefault();activate(0,true);}
        else if(e.key==='End'){e.preventDefault();activate(n-1,true);}
      }
      pill.addEventListener('click',onClick);
      pill.addEventListener('keydown',onKey);
      offs.push(function(){
        pill.removeEventListener('click',onClick);
        pill.removeEventListener('keydown',onKey);
      });
    });
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-qp-ready');
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

export const DOCKBAR_CSS = `.pagecraft-dockbar{position:relative;z-index:3;width:100%}
.pagecraft-dockbar-form{margin:0;padding:8px;display:flex;align-items:stretch;gap:0;background:var(--db-surface,#FFFFFF);border:1px solid var(--db-line,#C8D0DF);border-radius:var(--db-radius,4px);box-shadow:0 22px 52px rgba(12,18,32,.14)}
.pagecraft-dockbar-field{margin:0;padding:12px 18px;flex:1 1 0%;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px;border-radius:0;cursor:text}
.pagecraft-dockbar-field+.pagecraft-dockbar-field{border-inline-start:1px solid var(--db-line,#C8D0DF)}
.pagecraft-dockbar-lbl{font-size:11.5px;line-height:1.35;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--db-ink,#0C1220)}
.pagecraft-dockbar-input,.pagecraft-dockbar-select{appearance:none;width:100%;min-width:0;margin:0;padding:2px 0;border:0;background:transparent;font-family:inherit;font-size:14.5px;line-height:1.45;color:var(--db-ink,#0C1220);outline:none}
.pagecraft-dockbar-input::placeholder{color:var(--db-muted,#4A566E);opacity:1}
.pagecraft-dockbar-field:focus-within{box-shadow:inset 0 0 0 2px var(--db-accent,#1B3B9B)}
.pagecraft-dockbar-submit{appearance:none;margin:0 0 0 8px;padding:0 26px;min-height:54px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:var(--db-radius,4px);background:var(--db-accent,#1B3B9B);color:#FFFFFF;font-family:inherit;font-size:14.5px;font-weight:600;line-height:1.3;white-space:nowrap;text-decoration:none;cursor:pointer;transition:background-color .16s ease}
.pagecraft-dockbar-submit:hover,.pagecraft-dockbar-submit:focus-visible{background:var(--db-ink,#0C1220)}
.pagecraft-dockbar-submit:focus-visible{outline:2px solid var(--db-accent,#1B3B9B);outline-offset:2px}
@media (max-width:860px){
  .pagecraft-dockbar-form{flex-direction:column;padding:10px}
  .pagecraft-dockbar-field+.pagecraft-dockbar-field{border-inline-start:0;border-top:1px solid var(--db-line,#C8D0DF)}
  .pagecraft-dockbar-submit{margin:8px 0 0;width:100%;min-height:48px}
}
@media (prefers-reduced-motion:reduce){.pagecraft-dockbar-submit{transition:none}}`;

export const DOCKBAR_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-dockbar[data-dockbar]').forEach(function(root){
    if(root.hasAttribute('data-pc-db-ready'))return;
    root.setAttribute('data-pc-db-ready','1');
    var form=root.querySelector('.pagecraft-dockbar-form');
    if(!form)return;
    function onSubmit(e){
      var dest=form.getAttribute('data-dest')||'';
      if(!dest){e.preventDefault();return;}
      e.preventDefault();
      window.location.href=dest;
    }
    form.addEventListener('submit',onSubmit);
    disposers.push(function(){
      form.removeEventListener('submit',onSubmit);
      root.removeAttribute('data-pc-db-ready');
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

export const ARCHES_CSS = `.pagecraft-arches{width:100%;padding:14px 0 32px}
.pagecraft-arches-list{list-style:none;margin:0 auto;padding:0;max-width:1080px;display:flex;align-items:flex-end;justify-content:center}
.pagecraft-arches-item{margin:0 -10px;width:clamp(140px,18vw,212px);flex:0 1 auto;border-radius:999px 999px 14px 14px;overflow:hidden;border:3px solid var(--ar-frame,#FAF7F2);background:var(--ar-bg,#DCD3C6);box-shadow:0 22px 46px rgba(24,21,18,.15);transition:transform .34s cubic-bezier(.22,1,.36,1)}
.pagecraft-arches-item:nth-child(1){transform:translateY(26px) rotate(-7deg);z-index:1}
.pagecraft-arches-item:nth-child(2){transform:translateY(8px) rotate(-3.5deg);z-index:2}
.pagecraft-arches-item:nth-child(3){transform:translateY(-6px) rotate(0deg);z-index:4;width:clamp(154px,19.5vw,228px)}
.pagecraft-arches-item:nth-child(4){transform:translateY(8px) rotate(3.5deg);z-index:2}
.pagecraft-arches-item:nth-child(5){transform:translateY(26px) rotate(7deg);z-index:1}
.pagecraft-arches-item:hover{z-index:5;transform:translateY(-10px) rotate(0deg)}
.pagecraft-arches-img{display:block;width:100%;height:auto;aspect-ratio:2 / 3;object-fit:cover}
@media (max-width:860px){
  .pagecraft-arches{padding:4px 0 12px}
  .pagecraft-arches-list{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
  .pagecraft-arches-item,.pagecraft-arches-item:nth-child(n){margin:0;width:calc(33.333% - 7px);transform:none;border-width:2px}
}
@media (prefers-reduced-motion:reduce){.pagecraft-arches-item{transition:none}}`;

export const CHAPTERS_CSS = `.pagecraft-chapters{width:100%;display:flex;flex-direction:column;gap:22px}
.pagecraft-chapters-stage{position:relative;display:grid;border-radius:var(--ch-radius,14px);overflow:hidden;background:#161311;border:1px solid var(--ch-line,rgba(244,239,232,.14))}
.pagecraft-chapters-slide{grid-area:1 / 1;position:relative;margin:0;opacity:0;visibility:hidden;transition:opacity .38s cubic-bezier(.22,1,.36,1),visibility .38s ease}
.pagecraft-chapters-slide[data-active="1"]{opacity:1;visibility:visible}
.pagecraft-chapters-img{display:block;width:100%;height:auto;aspect-ratio:var(--ch-ratio,16 / 9);object-fit:cover}
.pagecraft-chapters-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(18,15,13,.04) 38%,rgba(18,15,13,.82) 100%);display:flex;align-items:flex-end;padding:32px 36px}
.pagecraft-chapters-overlay{margin:0;font-size:clamp(18px,2vw,24px);line-height:1.4;font-weight:500;color:#FAF7F2;max-width:46ch}
.pagecraft-chapters-nav{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:20px}
.pagecraft-chapters-btn{appearance:none;margin:0;padding:0;border:0;background:transparent;text-align:left;color:var(--ch-ink,#FAF7F2);font-family:inherit;display:flex;flex-direction:column;gap:10px;cursor:pointer}
.pagecraft-chapters-btn:focus-visible{outline:2px solid var(--ch-accent,#DF9E68);outline-offset:4px;border-radius:4px}
.pagecraft-chapters-bar{display:block;width:100%;height:2px;background:var(--ch-line,rgba(244,239,232,.2));overflow:hidden;border-radius:999px}
.pagecraft-chapters-fill{display:block;width:100%;height:100%;background:var(--ch-accent,#DF9E68);transform:scaleX(0);transform-origin:left center;transition:transform .3s ease}
.pagecraft-chapters-btn[aria-selected="true"] .pagecraft-chapters-fill{transform:scaleX(1)}
.pagecraft-chapters-title{font-size:16px;line-height:1.38;font-weight:600;color:var(--ch-ink,#FAF7F2)}
.pagecraft-chapters-btn[aria-selected="false"] .pagecraft-chapters-title{opacity:.76}
.pagecraft-chapters-sub{font-size:13.5px;line-height:1.48;color:var(--ch-muted,#C8BDB0)}
@media (max-width:860px){.pagecraft-chapters-scrim{padding:18px 20px}.pagecraft-chapters-nav{gap:14px}}
@media (prefers-reduced-motion:reduce){.pagecraft-chapters-slide,.pagecraft-chapters-fill{transition:none}}`;

export const CHAPTERS_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-chapters[data-chapters]').forEach(function(root){
    if(root.hasAttribute('data-pc-ch-ready'))return;
    root.setAttribute('data-pc-ch-ready','1');
    var btns=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-chapters-btn[data-ch-btn]'));
    var slides=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-chapters-slide[data-ch-slide]'));
    if(!btns.length||!slides.length)return;
    var cur=0;
    function select(idx,focusBtn){
      cur=idx;
      btns.forEach(function(b,i){
        var on=i===idx;
        b.setAttribute('aria-selected',on?'true':'false');
        b.setAttribute('tabindex',on?'0':'-1');
        if(on&&focusBtn)b.focus();
      });
      slides.forEach(function(s,i){
        var on=i===idx;
        s.setAttribute('data-active',on?'1':'0');
        s.setAttribute('aria-hidden',on?'false':'true');
      });
    }
    var offs=[];
    btns.forEach(function(btn,idx){
      function onClick(){select(idx,false);resetTimer();}
      function onKey(e){
        var n=btns.length;
        if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();select((idx+1)%n,true);resetTimer();}
        else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();select((idx-1+n)%n,true);resetTimer();}
      }
      btn.addEventListener('click',onClick);
      btn.addEventListener('keydown',onKey);
      offs.push(function(){
        btn.removeEventListener('click',onClick);
        btn.removeEventListener('keydown',onKey);
      });
    });
    var sec=parseFloat(root.getAttribute('data-auto')||'0');
    var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    var timer=null;
    function resetTimer(){
      if(timer){clearInterval(timer);timer=null;}
      if(sec>0&&!reduced&&btns.length>1){
        timer=setInterval(function(){if(!document.hidden)select((cur+1)%btns.length,false);},sec*1000);
      }
    }
    resetTimer();
    disposers.push(function(){
      if(timer)clearInterval(timer);
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-ch-ready');
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

export const SLOTPICKER_CSS = `.pagecraft-slotpicker{width:100%;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.85fr);gap:36px;align-items:start}
.pagecraft-sp-steps{display:flex;flex-direction:column;gap:26px}
.pagecraft-sp-group{display:flex;flex-direction:column;gap:12px}
.pagecraft-sp-step-h{margin:0;font-size:15px;line-height:1.4;font-weight:600;color:var(--sp-ink,#181512)}
.pagecraft-sp-passes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:12px}
.pagecraft-sp-pass{appearance:none;margin:0;padding:16px 18px;display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:left;font-family:inherit;background:var(--sp-surface,#FAF7F2);border:1px solid var(--sp-line,#DCD3C6);border-radius:var(--sp-radius,10px);color:var(--sp-ink,#181512);cursor:pointer;transition:border-color .16s ease,background-color .16s ease}
.pagecraft-sp-pass[aria-pressed="true"]{border-color:var(--sp-accent,#8F3D22);box-shadow:inset 0 0 0 1px var(--sp-accent,#8F3D22);background:color-mix(in srgb,var(--sp-accent,#8F3D22) 6%,var(--sp-surface,#FAF7F2))}
.pagecraft-sp-pass-name{font-size:15px;line-height:1.38;font-weight:600;color:var(--sp-ink,#181512)}
.pagecraft-sp-pass-meta{font-size:13px;line-height:1.45;color:var(--sp-muted,#5E5349)}
.pagecraft-sp-pass-price{font-size:14px;line-height:1.35;font-weight:700;color:var(--sp-accent,#8F3D22);margin-top:2px}
.pagecraft-sp-pills{display:flex;flex-wrap:wrap;gap:10px}
.pagecraft-sp-pill{appearance:none;margin:0;padding:10px 18px;min-height:42px;font-family:inherit;font-size:14px;line-height:1.35;font-weight:600;background:var(--sp-surface,#FAF7F2);color:var(--sp-ink,#181512);border:1px solid var(--sp-line,#DCD3C6);border-radius:999px;cursor:pointer;transition:background-color .16s ease,color .16s ease,border-color .16s ease}
.pagecraft-sp-pill[aria-pressed="true"]{background:var(--sp-accent,#8F3D22);border-color:var(--sp-accent,#8F3D22);color:#FFFFFF}
.pagecraft-sp-pass:focus-visible,.pagecraft-sp-pill:focus-visible{outline:2px solid var(--sp-accent,#8F3D22);outline-offset:2px}
.pagecraft-sp-summary{padding:28px;background:var(--sp-surface,#FAF7F2);border:1px solid var(--sp-line,#DCD3C6);border-radius:var(--sp-radius,10px);display:flex;flex-direction:column;gap:16px}
.pagecraft-sp-sum-title{margin:0;font-size:20px;line-height:1.35;font-weight:600;color:var(--sp-ink,#181512)}
.pagecraft-sp-rows{display:flex;flex-direction:column;gap:0;border-top:1px solid var(--sp-line,#DCD3C6)}
.pagecraft-sp-row{padding:11px 0;display:flex;justify-content:space-between;align-items:baseline;gap:12px;border-bottom:1px solid var(--sp-line,#DCD3C6);font-size:14px;line-height:1.45;color:var(--sp-muted,#5E5349)}
.pagecraft-sp-row strong{color:var(--sp-ink,#181512);font-weight:600;text-align:right}
.pagecraft-sp-total-row{padding-top:14px;display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:15px;line-height:1.4;font-weight:600;color:var(--sp-ink,#181512)}
.pagecraft-sp-total{font-size:28px;line-height:1.15;font-weight:600;font-variant-numeric:tabular-nums;color:var(--sp-accent,#8F3D22)}
.pagecraft-sp-confirm{padding:13px 20px;min-height:46px;display:inline-flex;align-items:center;justify-content:center;background:var(--sp-accent,#8F3D22);color:#FFFFFF;border-radius:999px;font-size:14.5px;font-weight:600;line-height:1.35;text-decoration:none;transition:opacity .16s ease}
.pagecraft-sp-confirm:hover,.pagecraft-sp-confirm:focus-visible{opacity:.9}
.pagecraft-sp-note{margin:0;font-size:13px;line-height:1.5;color:var(--sp-muted,#5E5349)}
@media (max-width:860px){.pagecraft-slotpicker{grid-template-columns:1fr;gap:24px}.pagecraft-sp-summary{padding:22px 20px}}
@media (prefers-reduced-motion:reduce){.pagecraft-sp-pass,.pagecraft-sp-pill,.pagecraft-sp-confirm{transition:none}}`;

export const SLOTPICKER_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-slotpicker[data-slotpicker]').forEach(function(root){
    if(root.hasAttribute('data-pc-sp-ready'))return;
    root.setAttribute('data-pc-sp-ready','1');
    var sym=root.getAttribute('data-sym')||'€';
    var passes=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-sp-pass[data-sp-pass]'));
    var guests=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-sp-pill[data-sp-guests]'));
    var slots=Array.prototype.slice.call(root.querySelectorAll('.pagecraft-sp-pill[data-sp-slot]'));
    var outPass=root.querySelector('[data-sp-pass-out]');
    var outGuest=root.querySelector('[data-sp-guest-out]');
    var outSlot=root.querySelector('[data-sp-slot-out]');
    var outTotal=root.querySelector('[data-sp-total]');
    var pIdx=0,gCnt=1,sIdx=0;
    function sync(){
      passes.forEach(function(b,i){b.setAttribute('aria-pressed',i===pIdx?'true':'false');});
      guests.forEach(function(b){b.setAttribute('aria-pressed',parseInt(b.getAttribute('data-sp-guests')||'1',10)===gCnt?'true':'false');});
      slots.forEach(function(b,i){b.setAttribute('aria-pressed',i===sIdx?'true':'false');});
      var pEl=passes[pIdx];
      if(pEl){
        var nm=pEl.getAttribute('data-name')||'';
        var unit=parseFloat(pEl.getAttribute('data-price')||'0');
        var fixed=pEl.getAttribute('data-fixed')==='1';
        var total=fixed?unit:unit*gCnt;
        if(outPass)outPass.textContent=nm;
        if(outTotal)outTotal.textContent=sym+Math.round(total);
      }
      if(outGuest)outGuest.textContent=gCnt+(gCnt===1?' Guest':' Guests');
      if(slots[sIdx]&&outSlot)outSlot.textContent=slots[sIdx].getAttribute('data-sp-slot')||'';
    }
    var offs=[];
    passes.forEach(function(b,i){
      function fn(){pIdx=i;sync();}
      b.addEventListener('click',fn);
      offs.push(function(){b.removeEventListener('click',fn);});
    });
    guests.forEach(function(b){
      function fn(){gCnt=parseInt(b.getAttribute('data-sp-guests')||'1',10);sync();}
      b.addEventListener('click',fn);
      offs.push(function(){b.removeEventListener('click',fn);});
    });
    slots.forEach(function(b,i){
      function fn(){sIdx=i;sync();}
      b.addEventListener('click',fn);
      offs.push(function(){b.removeEventListener('click',fn);});
    });
    sync();
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-pc-sp-ready');
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
