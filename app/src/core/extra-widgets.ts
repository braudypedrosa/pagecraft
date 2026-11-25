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
      var raw=parseFloat(range.value);var v=isFinite(raw)?Math.max(0,Math.min(100,raw)):50;
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
  .pagecraft-exhibit-year{grid-column:3;grid-row:1}
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
@media (max-width:767px){
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
.pagecraft-clocks-state[hidden]{display:none}
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
            var dec=hh+mm/60;
            var overnight=closes<opens;
            /* After midnight an overnight shift still belongs to the day it started. */
            var day=overnight&&dec<closes?({Mon:'Sun',Tue:'Mon',Wed:'Tue',Thu:'Wed',Fri:'Thu',Sat:'Fri',Sun:'Sat'})[wd]:wd;
            var weekend=day==='Sat'||day==='Sun';
            var isOpen=!weekend&&(overnight?dec>=opens||dec<closes:dec>=opens&&dec<closes);
            stateEl.removeAttribute('hidden');
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
@media (max-width:767px){
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
.pagecraft-tiers-cur[aria-pressed="true"]{background:var(--tr-accent,#1B3B9B);border-color:var(--tr-accent,#1B3B9B);color:var(--tr-on,#FFFFFF)}
.pagecraft-tiers-cur:focus-visible{outline:2px solid var(--tr-accent,#1B3B9B);outline-offset:2px}
.pagecraft-tiers-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:22px;align-items:stretch}
.pagecraft-tiers-card{padding:30px 28px;display:flex;flex-direction:column;gap:18px;background:var(--tr-surface,#FFFFFF);color:var(--tr-ink,#0C1220);border:1px solid var(--tr-line,#C8D0DF);border-radius:var(--tr-radius,2px)}
.pagecraft-tiers-card[data-featured="1"]{background:var(--tr-feat-bg,#0C1220);color:var(--tr-feat-ink,#F2F4F8);border-color:var(--tr-feat-bg,#0C1220)}
.pagecraft-tiers-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.pagecraft-tiers-name{margin:0;font-size:22px;line-height:1.3;font-weight:600;color:inherit}
.pagecraft-tiers-badge{padding:4px 10px;font-size:11.5px;line-height:1.3;font-weight:600;border-radius:2px;background:var(--tr-accent,#1B3B9B);color:var(--tr-on,#FFFFFF);white-space:nowrap}
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
.pagecraft-tiers-card[data-featured="1"] .pagecraft-tiers-btn{background:var(--tr-accent,#1B3B9B);border-color:var(--tr-accent,#1B3B9B);color:var(--tr-on,#FFFFFF)}
.pagecraft-tiers-btn:hover,.pagecraft-tiers-btn:focus-visible{background:var(--tr-accent,#1B3B9B);border-color:var(--tr-accent,#1B3B9B);color:var(--tr-on,#FFFFFF)}
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
.pagecraft-qapills-pill[aria-selected="true"]{background:var(--qp-accent,#1B3B9B);border-color:var(--qp-accent,#1B3B9B);color:var(--qp-on,#FFFFFF)}
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

export const DOCKBAR_CSS = `.pagecraft-form.pagecraft-dockbar{position:relative;z-index:3;display:flex;flex-wrap:wrap;align-items:stretch;gap:0;padding:8px;background:var(--db-surface,#FFFFFF);border:1px solid var(--db-line,#C8D0DF);border-radius:var(--db-radius,4px);box-shadow:0 22px 52px rgba(12,18,32,.14)}
.pagecraft-dockbar>.pagecraft-field,.pagecraft-dockbar>.pagecraft-field.half{flex:1 1 170px;min-width:0;padding:12px 18px;justify-content:center;gap:4px}
.pagecraft-dockbar>.pagecraft-field+.pagecraft-field{border-inline-start:1px solid var(--db-line,#C8D0DF)}
.pagecraft-dockbar>.pagecraft-field label{font-size:11.5px;line-height:1.35;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--db-ink,#0C1220)}
.pagecraft-dockbar>.pagecraft-field :is(input:not([type=checkbox]),select,textarea){min-width:0;padding:2px 0;border:0;border-radius:0;background:transparent;font-size:14.5px;line-height:1.45;color:var(--db-ink,#0C1220);outline:none}
.pagecraft-dockbar>.pagecraft-field textarea{height:1.9em;resize:none}
.pagecraft-dockbar>.pagecraft-field :is(input,textarea)::placeholder{color:var(--db-muted,#4A566E);opacity:1}
.pagecraft-dockbar>.pagecraft-field:focus-within{box-shadow:inset 0 0 0 2px var(--db-accent,#1B3B9B)}
.pagecraft-dockbar>.pagecraft-form-button{flex:0 0 auto;align-self:stretch;margin:0 0 0 8px;padding:0 26px;min-height:54px;border-radius:var(--db-radius,4px);background:var(--db-accent,#1B3B9B);color:var(--db-on,#FFFFFF);font-size:14.5px;line-height:1.3;transition:background-color .16s ease}
.pagecraft-dockbar>.pagecraft-form-button:is(:hover,:focus-visible):not(:disabled){background:var(--db-ink,#0C1220);color:var(--db-surface,#FFFFFF)}
.pagecraft-dockbar>.pagecraft-form-button:focus-visible{outline:2px solid var(--db-accent,#1B3B9B);outline-offset:2px}
.pagecraft-dockbar>.pagecraft-form-status{padding:8px 18px 4px;color:var(--db-muted,#4A566E)}
@media (max-width:767px){
  .pagecraft-dockbar>.pagecraft-field,.pagecraft-dockbar>.pagecraft-field.half{flex-basis:100%}
  .pagecraft-dockbar>.pagecraft-field+.pagecraft-field{border-inline-start:0;border-top:1px solid var(--db-line,#C8D0DF)}
  .pagecraft-dockbar>.pagecraft-form-button{flex:1 1 100%;margin:8px 0 0;min-height:48px}
}
@media (prefers-reduced-motion:reduce){.pagecraft-dockbar>.pagecraft-form-button{transition:none}}`;

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
.pagecraft-chapters-pause{position:absolute;inset-block-start:14px;inset-inline-end:14px;z-index:2;min-height:36px;padding:6px 14px;border:0;border-radius:999px;background:rgba(18,15,13,.72);color:#fff;font:600 13px/1.2 inherit;cursor:pointer}
.pagecraft-chapters-pause[hidden]{display:none}
.pagecraft-chapters-pause:focus-visible{outline:2px solid #fff;outline-offset:2px}
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
        else if(e.key==='Home'){e.preventDefault();select(0,true);resetTimer();}
        else if(e.key==='End'){e.preventDefault();select(n-1,true);resetTimer();}
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
    var timer=null,hover=false,focus=false,paused=false,held=false;
    var toggle=root.querySelector('[data-ch-pause]');
    function hold(){held=hover||focus||paused;}
    function onEnter(){hover=true;hold();}
    function onLeave(){hover=false;hold();}
    function onFocusIn(e){focus=e.target!==toggle;hold();}
    function onFocusOut(e){if(!root.contains(e.relatedTarget)){focus=false;hold();}}
    function onToggle(){paused=!paused;toggle.setAttribute('aria-pressed',paused?'true':'false');toggle.textContent=paused?'Play':'Pause';hold();}
    root.addEventListener('pointerenter',onEnter);root.addEventListener('pointerleave',onLeave);
    root.addEventListener('focusin',onFocusIn);root.addEventListener('focusout',onFocusOut);
    if(toggle){if(reduced||btns.length<2)toggle.hidden=true;else toggle.hidden=false;toggle.addEventListener('click',onToggle);}
    offs.push(function(){root.removeEventListener('pointerenter',onEnter);root.removeEventListener('pointerleave',onLeave);root.removeEventListener('focusin',onFocusIn);root.removeEventListener('focusout',onFocusOut);if(toggle)toggle.removeEventListener('click',onToggle);});
    function resetTimer(){
      if(timer){clearInterval(timer);timer=null;}
      if(sec>0&&!reduced&&btns.length>1){
        timer=setInterval(function(){if(!document.hidden&&!held)select((cur+1)%btns.length,false);},sec*1000);
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

export const SLOTPICKER_CSS = `.pagecraft-form.pagecraft-slotpicker{width:100%;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.85fr);gap:36px;align-items:start}
.pagecraft-slotpicker:not([data-ready]) .pagecraft-sp-buttons{display:none}
.pagecraft-slotpicker[data-ready] .pagecraft-sp-native{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.pagecraft-sp-group{position:relative}
.pagecraft-sp-contact{--f-gap:14px;--f-bg:var(--sp-surface,#FAF7F2);--f-text:var(--sp-ink,#181512);--f-label:var(--sp-muted,#5E5349);--f-border:var(--sp-line,#DCD3C6);--f-radius:var(--sp-radius,10px);--f-btn-bg:var(--sp-accent,#8F3D22);display:flex;flex-wrap:wrap;gap:var(--f-gap);font-size:15px}
.pagecraft-sp-percent>.pagecraft-field{flex:0 0 100%}
.pagecraft-sp-percent>.field-width-50{flex-basis:calc((100% - var(--f-gap)) / 2)}
.pagecraft-sp-percent>.field-width-33{flex-basis:calc((100% - var(--f-gap) * 2) / 3)}
.pagecraft-sp-percent>.field-width-25{flex-basis:calc((100% - var(--f-gap) * 3) / 4)}
.pagecraft-sp-percent>.field-width-20{flex-basis:calc((100% - var(--f-gap) * 4) / 5)}
.pagecraft-sp-pass:disabled,.pagecraft-sp-pill:disabled{cursor:not-allowed}
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
.pagecraft-sp-pill[aria-pressed="true"]{background:var(--sp-accent,#8F3D22);border-color:var(--sp-accent,#8F3D22);color:var(--sp-on,#FFFFFF)}
.pagecraft-sp-pass:focus-visible,.pagecraft-sp-pill:focus-visible{outline:2px solid var(--sp-accent,#8F3D22);outline-offset:2px}
.pagecraft-sp-summary{padding:28px;background:var(--sp-surface,#FAF7F2);border:1px solid var(--sp-line,#DCD3C6);border-radius:var(--sp-radius,10px);display:flex;flex-direction:column;gap:16px}
.pagecraft-sp-sum-title{margin:0;font-size:20px;line-height:1.35;font-weight:600;color:var(--sp-ink,#181512)}
.pagecraft-sp-rows{display:flex;flex-direction:column;gap:0;border-top:1px solid var(--sp-line,#DCD3C6)}
.pagecraft-sp-row{padding:11px 0;display:flex;justify-content:space-between;align-items:baseline;gap:12px;border-bottom:1px solid var(--sp-line,#DCD3C6);font-size:14px;line-height:1.45;color:var(--sp-muted,#5E5349)}
.pagecraft-sp-row strong{color:var(--sp-ink,#181512);font-weight:600;text-align:right}
.pagecraft-sp-total-row{padding-top:14px;display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:15px;line-height:1.4;font-weight:600;color:var(--sp-ink,#181512)}
.pagecraft-sp-total{font-size:28px;line-height:1.15;font-weight:600;font-variant-numeric:tabular-nums;color:var(--sp-accent,#8F3D22)}
.pagecraft-slotpicker .pagecraft-form-button{align-self:stretch;padding:13px 20px;min-height:46px;display:inline-flex;align-items:center;justify-content:center;background:var(--sp-accent,#8F3D22);color:var(--sp-on,#FFFFFF);border-radius:999px;font-size:14.5px;font-weight:600;line-height:1.35;text-decoration:none;transition:opacity .16s ease}
.pagecraft-slotpicker .pagecraft-form-button:is(:hover,:focus-visible):not(:disabled){opacity:.9}
.pagecraft-sp-note{margin:0;font-size:13px;line-height:1.5;color:var(--sp-muted,#5E5349)}
@media (max-width:860px){.pagecraft-form.pagecraft-slotpicker{grid-template-columns:1fr;gap:24px}.pagecraft-sp-summary{padding:22px 20px}}
@media (max-width:767px){.pagecraft-sp-percent>.pagecraft-field{flex-basis:100%}}
@media (prefers-reduced-motion:reduce){.pagecraft-sp-pass,.pagecraft-sp-pill,.pagecraft-slotpicker .pagecraft-form-button{align-self:stretch;transition:none}}`;

export const SLOTPICKER_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('.pagecraft-slotpicker[data-slotpicker]').forEach(function(root){
    if(root.hasAttribute('data-ready'))return;
    var groups=Array.prototype.slice.call(root.querySelectorAll('[data-sp-choice]')).map(function(el){
      return {key:el.getAttribute('data-sp-choice'),select:el.querySelector('select'),buttons:Array.prototype.slice.call(el.querySelectorAll('[data-sp-value]'))};
    }).filter(function(g){return g.select;});
    root.setAttribute('data-ready','');
    var totalEl=root.querySelector('[data-sp-total]');
    function sync(){
      var price=NaN,fixed=false,guests=1;
      groups.forEach(function(g){
        g.buttons.forEach(function(b){
          var on=b.getAttribute('data-sp-value')===g.select.value;
          b.setAttribute('aria-pressed',on?'true':'false');
          b.disabled=g.select.disabled;
          if(on&&g.key==='service'){price=parseFloat(b.getAttribute('data-price'));fixed=b.getAttribute('data-fixed')==='1';}
        });
        if(g.key==='guests')guests=parseInt(g.select.value,10)||1;
        var out=root.querySelector('[data-sp-out="'+g.key+'"]');
        if(out)out.textContent=g.select.value;
      });
      if(totalEl){
        var total=fixed?price:price*guests;
        totalEl.textContent=isFinite(total)?totalEl.getAttribute('data-sym')+(total%1?total.toFixed(2):total):'—';
      }
    }
    var offs=[];
    groups.forEach(function(g){
      g.select.setAttribute('tabindex','-1');
      g.select.addEventListener('change',sync);
      offs.push(function(){g.select.removeEventListener('change',sync);g.select.removeAttribute('tabindex');});
      g.buttons.forEach(function(b){
        function pick(){
          g.select.value=b.getAttribute('data-sp-value');
          g.select.dispatchEvent(new Event('input',{bubbles:true}));
          g.select.dispatchEvent(new Event('change',{bubbles:true}));
        }
        b.addEventListener('click',pick);
        offs.push(function(){b.removeEventListener('click',pick);});
      });
    });
    function onShow(){sync();}
    window.addEventListener('pageshow',onShow);
    offs.push(function(){window.removeEventListener('pageshow',onShow);});
    sync();
    disposers.push(function(){
      offs.forEach(function(off){off();});
      root.removeAttribute('data-ready');
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

/* ---- Typemask (SVG photo-clipped display wordmark) ---------------------- */
export const TYPEMASK_CSS = `
.pagecraft-typemask{display:block;width:100%;line-height:0;user-select:none}
.pagecraft-typemask-svg{display:block;width:100%;height:auto;overflow:visible}
.pagecraft-typemask-txt{font-family:inherit;font-weight:900;font-size:196px;letter-spacing:-0.02em;text-transform:uppercase}
`;

/* ---- Fullmenu (fullscreen index drawer with hover image preview) -------- */
export const FULLMENU_CSS = `
.pagecraft-fullmenu{display:inline-flex;align-items:center}
.pagecraft-fullmenu-btn{appearance:none;display:inline-flex;align-items:center;gap:10px;min-height:42px;padding:9px 18px;border-radius:999px;border:1px solid var(--fm-btn-border,rgba(244,247,245,.26));background:var(--fm-btn-bg,rgba(244,247,245,.08));color:var(--fm-btn-fg,#F4F7F5);font:inherit;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;transition:background-color .22s ease,border-color .22s ease,transform .22s ease}
.pagecraft-fullmenu-btn:hover{background:rgba(244,247,245,.16);border-color:rgba(244,247,245,.45)}
.pagecraft-fullmenu-btn:focus-visible,.pagecraft-fullmenu-close:focus-visible,.pagecraft-fullmenu-link:focus-visible{outline:2px solid var(--fm-accent,#C9F24B);outline-offset:3px}
.pagecraft-fullmenu-bars{display:inline-flex;flex-direction:column;gap:5px;width:16px}
.pagecraft-fullmenu-bars i{display:block;width:16px;height:1.5px;background:currentColor;border-radius:1px;transition:transform .28s cubic-bezier(.16,1,.3,1)}
.pagecraft-fullmenu-btn:hover .pagecraft-fullmenu-bars i:first-child{transform:translateX(2px)}
.pagecraft-fullmenu-btn:hover .pagecraft-fullmenu-bars i:last-child{transform:translateX(-2px)}
.pagecraft-fullmenu-dlg{box-sizing:border-box;display:none;position:fixed;inset:0;z-index:999;width:100%;max-width:none;height:100dvh;max-height:none;margin:0;padding:0;border:0;background:var(--fm-bg,#0A0E0C);color:var(--fm-ink,#F4F7F5);overflow:hidden;overscroll-behavior:contain;will-change:clip-path,opacity}
.pagecraft-fullmenu-dlg[open],.pagecraft-fullmenu-dlg[data-open="1"]{display:block}
.pagecraft-fullmenu-dlg::backdrop{background:rgba(6,9,8,.78);animation:pc-fm-backdrop .42s ease both}
.pagecraft-fullmenu-dlg[data-closing="1"]::backdrop{animation:pc-fm-backdrop-out .34s ease forwards}
.pagecraft-fullmenu-inner{box-sizing:border-box;width:100%;height:100%;display:flex;flex-direction:column;justify-content:space-between}
.pagecraft-fullmenu-top{box-sizing:border-box;width:100%;padding:14px 40px;border-bottom:1px solid rgba(244,247,245,.12)}
.pagecraft-fullmenu-bar{width:100%;max-width:var(--maxw,1240px);margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px}
.pagecraft-fullmenu-note{font-size:13px;color:var(--fm-muted,#A6B5AE);letter-spacing:.03em}
.pagecraft-fullmenu-close{appearance:none;display:inline-flex;align-items:center;gap:8px;min-height:42px;padding:9px 18px;border-radius:999px;border:1px solid rgba(244,247,245,.26);background:rgba(244,247,245,.08);color:var(--fm-ink,#F4F7F5);font:inherit;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;transition:background-color .2s ease,border-color .2s ease,color .2s ease}
.pagecraft-fullmenu-close:hover{border-color:var(--fm-accent,#C9F24B);color:var(--fm-accent,#C9F24B);background:rgba(201,242,75,.08)}
.pagecraft-fullmenu-body{flex:1;min-height:0;box-sizing:border-box;width:100%;padding:24px 40px 36px;display:flex;align-items:center}
.pagecraft-fullmenu-grid{width:100%;max-width:var(--maxw,1240px);margin:0 auto;min-height:0;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:clamp(28px,5vw,64px);align-items:center}
.pagecraft-fullmenu-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.pagecraft-fullmenu-list li{border-bottom:1px solid rgba(244,247,245,.12)}
.pagecraft-fullmenu-link{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:clamp(14px,2vh,20px) 4px;color:var(--fm-ink,#F4F7F5);text-decoration:none;transition:color .24s ease,transform .38s cubic-bezier(.16,1,.3,1)}
.pagecraft-fullmenu-link:hover,.pagecraft-fullmenu-link:focus-visible{color:var(--fm-accent,#C9F24B);transform:translateX(14px)}
.pagecraft-fullmenu-lbl{font-size:clamp(26px,3.5vw,44px);font-weight:700;line-height:1.08;letter-spacing:-0.02em}
.pagecraft-fullmenu-meta{font-size:13px;color:var(--fm-muted,#A6B5AE);letter-spacing:.03em;text-align:left;transition:color .24s ease}
.pagecraft-fullmenu-link:hover .pagecraft-fullmenu-meta,.pagecraft-fullmenu-link:focus-visible .pagecraft-fullmenu-meta{color:var(--fm-ink,#F4F7F5)}
.pagecraft-fullmenu-stage{position:relative;overflow:hidden;width:100%;aspect-ratio:4 / 5;max-height:62dvh;border-radius:12px;background-color:#151D19;background-size:cover;background-position:center;border:1px solid rgba(244,247,245,.12)}
.pagecraft-fullmenu-plate{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transform:scale(1.05);transition:opacity .48s cubic-bezier(.16,1,.3,1),transform .85s cubic-bezier(.16,1,.3,1);will-change:opacity,transform}
.pagecraft-fullmenu-plate[data-active="1"]{opacity:1;transform:scale(1)}
@keyframes pc-fm-wipe-in{from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes pc-fm-wipe-out{from{clip-path:inset(0 0 0 0);opacity:1}to{clip-path:inset(0 0 100% 0);opacity:.96}}
@keyframes pc-fm-rise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes pc-fm-stage{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
@keyframes pc-fm-backdrop{from{opacity:0}to{opacity:1}}
@keyframes pc-fm-backdrop-out{from{opacity:1}to{opacity:0}}
@media(prefers-reduced-motion:no-preference){
  .pagecraft-fullmenu-dlg[open]:not([data-closing="1"]),.pagecraft-fullmenu-dlg[data-open="1"]:not([data-closing="1"]){animation:pc-fm-wipe-in .5s cubic-bezier(.76,0,.24,1) both}
  .pagecraft-fullmenu-dlg[data-closing="1"]{animation:pc-fm-wipe-out .36s cubic-bezier(.76,0,.24,1) forwards;pointer-events:none}
  .pagecraft-fullmenu-dlg[open]:not([data-closing="1"]) .pagecraft-fullmenu-list li,.pagecraft-fullmenu-dlg[data-open="1"]:not([data-closing="1"]) .pagecraft-fullmenu-list li{animation:pc-fm-rise .58s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(.14s + var(--fm-i,0) * 55ms)}
  .pagecraft-fullmenu-dlg[open]:not([data-closing="1"]) .pagecraft-fullmenu-stage,.pagecraft-fullmenu-dlg[data-open="1"]:not([data-closing="1"]) .pagecraft-fullmenu-stage{animation:pc-fm-stage .64s cubic-bezier(.16,1,.3,1) .16s both}
}
@media(prefers-reduced-motion:reduce){
  .pagecraft-fullmenu-btn,.pagecraft-fullmenu-bars i,.pagecraft-fullmenu-close,.pagecraft-fullmenu-link,.pagecraft-fullmenu-meta,.pagecraft-fullmenu-plate{transition:none}
  .pagecraft-fullmenu-dlg::backdrop,.pagecraft-fullmenu-dlg[data-closing="1"]::backdrop{animation:none}
}
@media(max-width:1024px){
  .pagecraft-fullmenu-top{padding:13px 28px}
  .pagecraft-fullmenu-body{padding:22px 28px 30px}
}
@media(max-width:767px){
  .pagecraft-fullmenu-top{padding:12px 20px}
  .pagecraft-fullmenu-body{padding:20px 20px 26px}
  .pagecraft-fullmenu-grid{grid-template-columns:1fr;align-content:center}
  .pagecraft-fullmenu-stage{display:none}
  .pagecraft-fullmenu-link{flex-direction:column;align-items:flex-start;gap:4px}
  .pagecraft-fullmenu-meta{text-align:left}
}
`;

export const FULLMENU_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('[data-fullmenu]').forEach(function(root){
    if(root.hasAttribute('data-pc-fm-ready'))return;
    root.setAttribute('data-pc-fm-ready','1');
    var btn=root.querySelector('.pagecraft-fullmenu-btn');
    var dlg=root.querySelector('.pagecraft-fullmenu-dlg');
    var closeBtn=root.querySelector('.pagecraft-fullmenu-close');
    var stage=root.querySelector('.pagecraft-fullmenu-stage');
    var plates=[].slice.call(root.querySelectorAll('.pagecraft-fullmenu-plate'));
    var links=[].slice.call(root.querySelectorAll('.pagecraft-fullmenu-link'));
    if(!btn||!dlg)return;
    var isOpen=false;
    var closeTimer=0;
    function preventBgScroll(e){
      if(!isOpen)return;
      e.preventDefault();
    }
    function finishClose(){
      if(closeTimer){clearTimeout(closeTimer);closeTimer=0;}
      dlg.removeAttribute('data-closing');
      dlg.removeAttribute('data-open');
      if(typeof dlg.close==='function'&&dlg.open){try{dlg.close();}catch(_e){dlg.removeAttribute('open');}}
      else{dlg.removeAttribute('open');}
    }
    function openMenu(){
      if(closeTimer){clearTimeout(closeTimer);closeTimer=0;}
      dlg.removeAttribute('data-closing');
      if(isOpen)return;
      isOpen=true;
      btn.setAttribute('aria-expanded','true');
      dlg.setAttribute('data-open','1');
      if(typeof dlg.showModal==='function'){try{if(!dlg.open)dlg.showModal();}catch(_e){dlg.setAttribute('open','');}}
      else{dlg.setAttribute('open','');}
    }
    function closeMenu(immediate){
      if(!isOpen&&!closeTimer)return;
      isOpen=false;
      btn.setAttribute('aria-expanded','false');
      var reduced=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(immediate===true||reduced){
        finishClose();
        return;
      }
      dlg.setAttribute('data-closing','1');
      if(closeTimer)clearTimeout(closeTimer);
      closeTimer=setTimeout(finishClose,360);
    }
    function onNativeClose(){
      if(closeTimer){clearTimeout(closeTimer);closeTimer=0;}
      dlg.removeAttribute('data-closing');
      dlg.removeAttribute('data-open');
      isOpen=false;
      btn.setAttribute('aria-expanded','false');
    }
    function onCancel(e){
      e.preventDefault();
      closeMenu(false);
    }
    function onBackdrop(e){if(e.target===dlg)closeMenu(false);}
    function onKey(e){
      if(!isOpen)return;
      if(e.key==='Escape'){e.preventDefault();closeMenu(false);return;}
      if(e.key==='PageDown'||e.key==='PageUp'||e.key==='Home'||e.key==='End'||(e.key===' '&&e.target===dlg)){
        e.preventDefault();
      }
    }
    var offs=[];
    window.addEventListener('wheel',preventBgScroll,{passive:false});
    window.addEventListener('touchmove',preventBgScroll,{passive:false});
    offs.push(function(){
      window.removeEventListener('wheel',preventBgScroll);
      window.removeEventListener('touchmove',preventBgScroll);
    });
    btn.addEventListener('click',openMenu);
    offs.push(function(){btn.removeEventListener('click',openMenu);});
    if(closeBtn){
      function onCloseClick(){closeMenu(false);}
      closeBtn.addEventListener('click',onCloseClick);
      offs.push(function(){closeBtn.removeEventListener('click',onCloseClick);});
    }
    dlg.addEventListener('cancel',onCancel);
    dlg.addEventListener('close',onNativeClose);
    dlg.addEventListener('click',onBackdrop);
    document.addEventListener('keydown',onKey);
    offs.push(function(){
      dlg.removeEventListener('cancel',onCancel);
      dlg.removeEventListener('close',onNativeClose);
      dlg.removeEventListener('click',onBackdrop);
      document.removeEventListener('keydown',onKey);
    });
    links.forEach(function(lk){
      function onPreview(){
        var src=lk.getAttribute('data-preview-src');
        var idx=lk.getAttribute('data-preview-idx');
        if(src&&stage)stage.style.backgroundImage='url("'+src.replace(/"/g,'\\"')+'")';
        if(idx!==null&&plates.length){
          plates.forEach(function(pl){pl.setAttribute('data-active',pl.getAttribute('data-fm-plate')===idx?'1':'0');});
        }
      }
      function onNavClick(){closeMenu(true);}
      lk.addEventListener('mouseenter',onPreview);
      lk.addEventListener('focus',onPreview);
      lk.addEventListener('click',onNavClick);
      offs.push(function(){
        lk.removeEventListener('mouseenter',onPreview);
        lk.removeEventListener('focus',onPreview);
        lk.removeEventListener('click',onNavClick);
      });
    });
    disposers.push(function(){
      closeMenu(true);
      offs.forEach(function(fn){fn();});
      root.removeAttribute('data-pc-fm-ready');
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

/* ---- Swatchshop (product cards with live colourway swatch switcher) ----- */
export const SWATCHSHOP_CSS = `
.pagecraft-swatchshop{display:block;width:100%}
.pagecraft-swatch-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(var(--swp-cols,4),minmax(0,1fr));gap:22px}
.pagecraft-swatch-card{box-sizing:border-box;display:flex;flex-direction:column;padding:16px;background:var(--swp-surface,#FFFFFF);border:1px solid var(--swp-line,#D4DCD7);border-radius:var(--swp-radius,10px);color:var(--swp-ink,#0E1512)}
.pagecraft-swatch-media{width:100%;aspect-ratio:4 / 5;border-radius:calc(var(--swp-radius,10px) - 3px);overflow:hidden;background:var(--swp-media-bg,#E7ECE9);margin-bottom:16px}
.pagecraft-swatch-img{display:block;width:100%;height:100%;object-fit:cover}
.pagecraft-swatch-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:6px}
.pagecraft-swatch-name{margin:0;font-size:18px;font-weight:700;line-height:1.25;color:var(--swp-ink,#0E1512)}
.pagecraft-swatch-price{font-size:15px;font-weight:600;color:var(--swp-ink,#0E1512);white-space:nowrap}
.pagecraft-swatch-active{margin:0 0 16px;font-size:13px;line-height:1.45;color:var(--swp-muted,#4A5952)}
.pagecraft-swatch-foot{margin-top:auto;padding-top:14px;border-top:1px solid var(--swp-line,#D4DCD7);display:flex;align-items:center;justify-content:space-between;gap:12px}
.pagecraft-swatch-dots{display:inline-flex;align-items:center;gap:9px}
.pagecraft-swatch-dot{appearance:none;width:24px;height:24px;min-width:24px;min-height:24px;padding:0;border-radius:999px;border:2px solid rgba(14,21,18,.2);cursor:pointer;transition:transform .16s ease,box-shadow .16s ease}
.pagecraft-swatch-dot[aria-pressed="true"]{box-shadow:0 0 0 2px var(--swp-surface,#FFFFFF),0 0 0 4px var(--swp-ink,#0E1512);transform:scale(1.06)}
.pagecraft-swatch-dot:focus-visible,.pagecraft-swatch-link:focus-visible{outline:2px solid var(--swp-accent,#145C3E);outline-offset:3px}
.pagecraft-swatch-link{font-size:13px;font-weight:600;color:var(--swp-accent,#145C3E);text-decoration:none;white-space:nowrap}
.pagecraft-swatch-link:hover{text-decoration:underline}
@media(prefers-reduced-motion:reduce){.pagecraft-swatch-dot{transition:none}}
@media(max-width:1024px){.pagecraft-swatch-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:767px){.pagecraft-swatch-grid{grid-template-columns:1fr}}
`;

export const SWATCHSHOP_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('[data-swatchshop]').forEach(function(root){
    if(root.hasAttribute('data-pc-swp-ready'))return;
    root.setAttribute('data-pc-swp-ready','1');
    var offs=[];
    root.querySelectorAll('.pagecraft-swatch-card').forEach(function(card){
      var img=card.querySelector('.pagecraft-swatch-img');
      var activeOut=card.querySelector('[data-swp-active]');
      var spec=card.getAttribute('data-spec')||'';
      var dots=[].slice.call(card.querySelectorAll('.pagecraft-swatch-dot'));
      dots.forEach(function(dot){
        function onPick(){
          dots.forEach(function(d){d.setAttribute('aria-pressed',d===dot?'true':'false');});
          var src=dot.getAttribute('data-swp-src')||'';
          var nm=dot.getAttribute('data-swp-name')||'';
          if(img&&src)img.setAttribute('src',src);
          if(activeOut)activeOut.textContent=nm+(spec?' · '+spec:'');
        }
        dot.addEventListener('click',onPick);
        offs.push(function(){dot.removeEventListener('click',onPick);});
      });
    });
    disposers.push(function(){
      offs.forEach(function(fn){fn();});
      root.removeAttribute('data-pc-swp-ready');
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

/* ---- Snaprail (horizontal snap-scroll colour-drenched card rail) -------- */
export const SNAPRAIL_CSS = `
.pagecraft-snaprail{display:block;width:100%}
.pagecraft-snaprail-controls{display:flex;justify-content:flex-end;gap:10px;margin-bottom:16px}
.pagecraft-snaprail-arrow{appearance:none;width:42px;height:42px;border-radius:999px;border:1px solid var(--sr-btn-line,#D4DCD7);background:var(--sr-btn-bg,#FFFFFF);color:var(--sr-btn-ink,#0E1512);font:inherit;font-size:16px;line-height:1;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .16s ease,border-color .16s ease}
.pagecraft-snaprail-arrow:hover{transform:translateY(-1px);border-color:var(--sr-btn-ink,#0E1512)}
.pagecraft-snaprail-arrow:focus-visible,.pagecraft-snaprail-track:focus-visible{outline:2px solid var(--sr-btn-ink,#0E1512);outline-offset:3px}
.pagecraft-snaprail-track{list-style:none;margin:0;padding:2px 0 12px;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(280px,var(--sr-card-w,340px));gap:20px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:thin}
.pagecraft-snaprail-card{box-sizing:border-box;scroll-snap-align:start;min-height:var(--sr-card-h,400px);padding:28px;border-radius:var(--sr-radius,14px);display:flex;flex-direction:column;justify-content:space-between;gap:28px}
.pagecraft-snaprail-top{display:flex;flex-direction:column;gap:12px}
.pagecraft-snaprail-tag{font-size:13px;font-weight:600;letter-spacing:.04em;color:inherit}
.pagecraft-snaprail-title{margin:0;font-size:clamp(22px,2.4vw,28px);font-weight:700;line-height:1.15;letter-spacing:-0.01em;color:inherit}
.pagecraft-snaprail-detail{margin:0;font-size:15px;line-height:1.6;color:inherit}
.pagecraft-snaprail-stat{margin:0;padding-top:16px;border-top:1px solid currentColor;font-size:14px;font-weight:700;letter-spacing:.03em;color:inherit}
@media(prefers-reduced-motion:reduce){
  .pagecraft-snaprail-track{scroll-behavior:auto}
  .pagecraft-snaprail-arrow{transition:none}
}
@media(max-width:767px){
  .pagecraft-snaprail-track{grid-auto-columns:85%}
  .pagecraft-snaprail-card{min-height:340px;padding:22px}
}
`;

export const SNAPRAIL_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('[data-snaprail]').forEach(function(root){
    if(root.hasAttribute('data-pc-sr-ready'))return;
    root.setAttribute('data-pc-sr-ready','1');
    var track=root.querySelector('.pagecraft-snaprail-track');
    var btns=[].slice.call(root.querySelectorAll('[data-sr-dir]'));
    if(!track)return;
    var offs=[];
    btns.forEach(function(btn){
      function onStep(){
        var dir=parseInt(btn.getAttribute('data-sr-dir')||'1',10);
        var card=track.querySelector('.pagecraft-snaprail-card');
        var step=(card?card.getBoundingClientRect().width:320)+20;
        var reduced=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if(typeof track.scrollBy==='function')track.scrollBy({left:dir*step,behavior:reduced?'auto':'smooth'});
        else track.scrollLeft+=dir*step;
      }
      btn.addEventListener('click',onStep);
      offs.push(function(){btn.removeEventListener('click',onStep);});
    });
    disposers.push(function(){
      offs.forEach(function(fn){fn();});
      root.removeAttribute('data-pc-sr-ready');
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

/* ---- Scrollsteps (scroll-filled vertical process / repair seam steps) --- */
export const SCROLLSTEPS_CSS = `
.pagecraft-scrollsteps{position:relative;display:block;width:100%;box-sizing:border-box;padding-left:62px}
.pagecraft-scrollsteps-spine{position:absolute;left:18px;top:20px;bottom:24px;width:2px;background:var(--ss-line,#BDCBC3);overflow:hidden;border-radius:2px}
.pagecraft-scrollsteps-fill{width:100%;height:100%;background:var(--ss-accent,#145C3E);transform-origin:top center;transform:scaleY(var(--ss-progress,.28));transition:transform .24s ease-out}
.pagecraft-scrollsteps-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:0}
.pagecraft-scrollsteps-item{position:relative;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:24px;align-items:center;padding:24px 0;border-bottom:1px solid var(--ss-line,#BDCBC3);color:var(--ss-ink,#0E1512);cursor:pointer}
.pagecraft-scrollsteps-item:first-child{padding-top:2px}
.pagecraft-scrollsteps-item:last-child{border-bottom:0;padding-bottom:4px}
.pagecraft-scrollsteps-item[data-no-img="1"]{grid-template-columns:1fr}
.pagecraft-scrollsteps-item:focus-visible{outline:2px solid var(--ss-accent,#145C3E);outline-offset:4px;border-radius:6px}
.pagecraft-scrollsteps-dot{position:absolute;left:-62px;top:22px;width:38px;height:38px;box-sizing:border-box;border-radius:999px;background:var(--ss-surface,#FFFFFF);border:2px solid var(--ss-line,#BDCBC3);color:var(--ss-muted,#4A5952);display:inline-flex;align-items:center;justify-content:center;transition:background-color .2s ease,border-color .2s ease,color .2s ease}
.pagecraft-scrollsteps-item:first-child .pagecraft-scrollsteps-dot{top:0}
.pagecraft-scrollsteps-item[data-active="1"] .pagecraft-scrollsteps-dot{background:var(--ss-accent,#145C3E);border-color:var(--ss-accent,#145C3E);color:var(--ss-on,#FFFFFF)}
.pagecraft-scrollsteps-copy{display:flex;flex-direction:column;gap:8px}
.pagecraft-scrollsteps-title{margin:0;font-size:clamp(19px,2vw,23px);font-weight:700;line-height:1.22;color:var(--ss-ink,#0E1512)}
.pagecraft-scrollsteps-detail{margin:0;font-size:15px;line-height:1.62;color:var(--ss-muted,#4A5952);max-width:54ch}
.pagecraft-scrollsteps-badge{display:inline-flex;align-items:center;margin-top:2px;padding:4px 11px;border-radius:999px;background:var(--ss-surface,#FFFFFF);border:1px solid var(--ss-line,#BDCBC3);font-size:12px;font-weight:600;color:var(--ss-ink,#0E1512);white-space:nowrap}
.pagecraft-scrollsteps-img{display:block;width:220px;max-width:100%;height:auto;aspect-ratio:16 / 10;object-fit:cover;border-radius:var(--ss-radius,8px)}
@media(prefers-reduced-motion:reduce){
  .pagecraft-scrollsteps-fill,.pagecraft-scrollsteps-dot{transition:none}
}
@media(max-width:767px){
  .pagecraft-scrollsteps{padding-left:48px}
  .pagecraft-scrollsteps-spine{left:15px}
  .pagecraft-scrollsteps-dot{left:-48px;width:32px;height:32px}
  .pagecraft-scrollsteps-item{grid-template-columns:1fr;gap:14px;padding:20px 0}
  .pagecraft-scrollsteps-img{width:100%;order:-1}
}
`;

export const SCROLLSTEPS_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('[data-scrollsteps]').forEach(function(root){
    if(root.hasAttribute('data-pc-ss-ready'))return;
    root.setAttribute('data-pc-ss-ready','1');
    var items=[].slice.call(root.querySelectorAll('.pagecraft-scrollsteps-item'));
    if(!items.length)return;
    var activeIdx=0;
    function setActive(idx){
      activeIdx=Math.max(0,Math.min(items.length-1,idx));
      items.forEach(function(el,i){el.setAttribute('data-active',i<=activeIdx?'1':'0');});
      var frac=(activeIdx+1)/items.length;
      root.style.setProperty('--ss-progress',frac.toFixed(3));
    }
    var offs=[];
    items.forEach(function(el,i){
      function onPick(){setActive(i);}
      function onKey(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();setActive(i);}}
      el.addEventListener('click',onPick);
      el.addEventListener('keydown',onKey);
      offs.push(function(){
        el.removeEventListener('click',onPick);
        el.removeEventListener('keydown',onKey);
      });
    });
    function onScroll(){
      var vh=window.innerHeight||800;
      var best=activeIdx;
      for(var i=0;i<items.length;i++){
        var r=items[i].getBoundingClientRect();
        if(r.top<=vh*0.62)best=i;
      }
      if(best!==activeIdx)setActive(best);
    }
    window.addEventListener('scroll',onScroll,{passive:true});
    offs.push(function(){window.removeEventListener('scroll',onScroll);});
    setActive(0);
    disposers.push(function(){
      offs.forEach(function(fn){fn();});
      root.removeAttribute('data-pc-ss-ready');
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

/* ---- Dragstrip (WSC-288 mouse-drag photo filmstrip + live scrollbar) ---- */
export const DRAGSTRIP_CSS = `
.pagecraft-dragstrip{display:block;width:100%;overflow:hidden}
.pagecraft-dragstrip-rail{list-style:none;margin:0;padding:0 0 6px;display:flex;gap:20px;overflow-x:auto;scrollbar-width:none;cursor:grab;user-select:none}
.pagecraft-dragstrip-rail::-webkit-scrollbar{display:none}
.pagecraft-dragstrip-rail.is-dragging{cursor:grabbing}
.pagecraft-dragstrip-rail:focus-visible,.pagecraft-dragstrip-track:focus-visible,.pagecraft-dragstrip-link:focus-visible{outline:2px solid var(--ds-accent,#1456A0);outline-offset:4px;border-radius:6px}
.pagecraft-dragstrip-item{flex:0 0 clamp(280px,42vw,var(--ds-card-w,440px));min-width:0}
.pagecraft-dragstrip-link{display:block;color:inherit;text-decoration:none}
.pagecraft-dragstrip-img{display:block;width:100%;height:auto;aspect-ratio:var(--ds-ratio,3 / 2);object-fit:cover;border-radius:var(--ds-radius,10px);pointer-events:none}
.pagecraft-dragstrip-cap{display:flex;align-items:baseline;justify-content:space-between;gap:14px;margin:12px 0 0;font-size:14px;line-height:1.4;color:var(--ds-muted,#4E5F78)}
.pagecraft-dragstrip-title{font-size:18px;font-weight:600;color:var(--ds-ink,#122136)}
.pagecraft-dragstrip-meta{white-space:nowrap;font-size:13px;color:var(--ds-muted,#4E5F78)}
.pagecraft-dragstrip-track{position:relative;height:24px;margin-top:16px;cursor:pointer;touch-action:none}
.pagecraft-dragstrip-track::before{content:"";position:absolute;left:0;right:0;top:10px;height:4px;border-radius:4px;background:var(--ds-line,#D5DFEC)}
.pagecraft-dragstrip-bar{position:absolute;top:8px;left:0;display:block;width:28%;height:8px;border-radius:8px;background:var(--ds-accent,#1456A0);cursor:grab;transition:height .15s ease,top .15s ease}
.pagecraft-dragstrip-track:hover .pagecraft-dragstrip-bar,.pagecraft-dragstrip-track.is-dragging .pagecraft-dragstrip-bar{top:7px;height:10px}
.pagecraft-dragstrip-track.is-dragging .pagecraft-dragstrip-bar{cursor:grabbing}
@media(prefers-reduced-motion:reduce){.pagecraft-dragstrip-bar{transition:none}}
@media(max-width:767px){
  .pagecraft-dragstrip-item{flex-basis:84%}
  .pagecraft-dragstrip-cap{flex-direction:column;gap:3px}
}
`;

export const DRAGSTRIP_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('[data-dragstrip]').forEach(function(root){
    if(root.hasAttribute('data-pc-ds-ready'))return;
    root.setAttribute('data-pc-ds-ready','1');
    var strip=root.querySelector('[data-ds-strip]');
    var track=root.querySelector('[data-ds-track]');
    var bar=root.querySelector('[data-ds-bar]');
    if(!strip||!track||!bar)return;
    function maxScroll(){return Math.max(0,strip.scrollWidth-strip.clientWidth);}
    function update(){
      var sw=strip.scrollWidth||1,cw=strip.clientWidth||1;
      var share=Math.min(1,Math.max(0.14,cw/sw));
      var m=maxScroll();
      var ratio=m>0?Math.min(1,Math.max(0,strip.scrollLeft/m)):0;
      bar.style.width=(share*100).toFixed(2)+'%';
      bar.style.left=(ratio*(1-share)*100).toFixed(2)+'%';
      track.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
    }
    var startX=0,startLeft=0,dragging=false,moved=false;
    function onDown(e){
      if(e.pointerType&&e.pointerType!=='mouse')return;
      dragging=true;moved=false;startX=e.clientX;startLeft=strip.scrollLeft;
      if(typeof strip.setPointerCapture==='function'){try{strip.setPointerCapture(e.pointerId);}catch(_e){}}
      strip.classList.add('is-dragging');
    }
    function onMove(e){
      if(!dragging)return;
      var dx=e.clientX-startX;
      if(Math.abs(dx)>3)moved=true;
      strip.scrollLeft=startLeft-dx;
    }
    function onEnd(){dragging=false;strip.classList.remove('is-dragging');}
    function onClickCap(e){if(moved){e.preventDefault();moved=false;}}
    var thumbStart=0,thumbLeft=0,thumbDrag=false;
    function scale(){return maxScroll()/Math.max(1,(track.clientWidth-bar.offsetWidth)||1);}
    function onTrackDown(e){
      if(typeof track.setPointerCapture==='function'){try{track.setPointerCapture(e.pointerId);}catch(_e){}}
      thumbDrag=true;track.classList.add('is-dragging');
      if(e.target!==bar){
        var r=track.getBoundingClientRect();
        strip.scrollLeft=(e.clientX-r.left-(bar.offsetWidth||40)/2)*scale();
      }
      thumbStart=e.clientX;thumbLeft=strip.scrollLeft;
      update();
    }
    function onTrackMove(e){if(thumbDrag){strip.scrollLeft=thumbLeft+(e.clientX-thumbStart)*scale();update();}}
    function onTrackEnd(){thumbDrag=false;track.classList.remove('is-dragging');}
    function onKey(e){
      var step=Math.max(220,(strip.clientWidth||600)*0.5);
      if(e.key==='ArrowRight')strip.scrollLeft+=step;
      else if(e.key==='ArrowLeft')strip.scrollLeft-=step;
      else if(e.key==='Home')strip.scrollLeft=0;
      else if(e.key==='End')strip.scrollLeft=maxScroll();
      else return;
      e.preventDefault();
      update();
    }
    strip.addEventListener('pointerdown',onDown);
    strip.addEventListener('pointermove',onMove);
    strip.addEventListener('pointerup',onEnd);
    strip.addEventListener('pointercancel',onEnd);
    strip.addEventListener('click',onClickCap,true);
    strip.addEventListener('scroll',update,{passive:true});
    strip.addEventListener('keydown',onKey);
    track.addEventListener('pointerdown',onTrackDown);
    track.addEventListener('pointermove',onTrackMove);
    track.addEventListener('pointerup',onTrackEnd);
    track.addEventListener('pointercancel',onTrackEnd);
    track.addEventListener('keydown',onKey);
    var ro=null;
    if(typeof ResizeObserver==='function'){ro=new ResizeObserver(update);ro.observe(strip);}
    window.addEventListener('resize',update);
    update();
    disposers.push(function(){
      strip.removeEventListener('pointerdown',onDown);
      strip.removeEventListener('pointermove',onMove);
      strip.removeEventListener('pointerup',onEnd);
      strip.removeEventListener('pointercancel',onEnd);
      strip.removeEventListener('click',onClickCap,true);
      strip.removeEventListener('scroll',update);
      strip.removeEventListener('keydown',onKey);
      track.removeEventListener('pointerdown',onTrackDown);
      track.removeEventListener('pointermove',onTrackMove);
      track.removeEventListener('pointerup',onTrackEnd);
      track.removeEventListener('pointercancel',onTrackEnd);
      track.removeEventListener('keydown',onKey);
      window.removeEventListener('resize',update);
      if(ro)ro.disconnect();
      root.removeAttribute('data-pc-ds-ready');
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

/* ---- Stayfilter (WSC-298 guest stepper + 3-season rate switcher) -------- */
export const STAYFILTER_CSS = `
.pagecraft-stayfilter{display:block;width:100%;color:var(--sf-ink,#122136)}
.pagecraft-stayfilter [hidden]{display:none!important}
.pagecraft-stay-bar{box-sizing:border-box;display:flex;align-items:center;gap:12px 20px;flex-wrap:wrap;margin:0 0 18px;padding:12px 16px;border:1px solid var(--sf-line,#D5DFEC);border-radius:var(--sf-radius,14px);background:var(--sf-surface,#FFFFFF)}
.pagecraft-stay-guests{display:inline-flex;align-items:center;gap:8px}
.pagecraft-stay-glbl{margin-right:4px;color:var(--sf-muted,#4E5F78);font-size:14px;font-weight:600}
.pagecraft-stay-step{appearance:none;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border:1px solid var(--sf-line,#D5DFEC);border-radius:999px;background:transparent;color:var(--sf-ink,#122136);font:inherit;font-size:18px;line-height:1;cursor:pointer;transition:border-color .16s ease,color .16s ease}
.pagecraft-stay-step:hover:not(:disabled){border-color:var(--sf-accent,#1456A0);color:var(--sf-accent,#1456A0)}
.pagecraft-stay-step:disabled{opacity:.35;cursor:not-allowed}
.pagecraft-stay-step:focus-visible,.pagecraft-stay-sbtn:focus-visible,.pagecraft-stay-cta:focus-visible{outline:2px solid var(--sf-accent,#1456A0);outline-offset:3px}
.pagecraft-stay-count{min-width:2ch;font-size:16px;font-weight:700;text-align:center;font-variant-numeric:tabular-nums;color:var(--sf-ink,#122136)}
.pagecraft-stay-seasons{display:inline-flex;gap:4px;padding:4px;border-radius:10px;background:var(--sf-bg,#F4F6FA)}
.pagecraft-stay-sbtn{appearance:none;min-height:38px;padding:0 14px;border:0;border-radius:8px;background:transparent;color:var(--sf-muted,#4E5F78);font:inherit;font-size:14px;font-weight:500;white-space:nowrap;cursor:pointer;transition:background-color .16s ease,color .16s ease}
.pagecraft-stay-sbtn[aria-checked="true"]{background:var(--sf-surface,#FFFFFF);color:var(--sf-ink,#122136);font-weight:700;box-shadow:0 1px 3px rgba(18,33,54,.12)}
.pagecraft-stay-result{margin:0 0 0 auto;color:var(--sf-muted,#4E5F78);font-size:14px;font-weight:600}
.pagecraft-stay-list{margin:0;padding:0;list-style:none;display:grid;gap:14px}
.pagecraft-stay-row{box-sizing:border-box;display:grid;grid-template-columns:270px minmax(0,1fr) auto;gap:24px;align-items:center;padding:14px;border:1px solid var(--sf-line,#D5DFEC);border-radius:var(--sf-radius,14px);background:var(--sf-surface,#FFFFFF)}
.pagecraft-stay-img{display:block;width:100%;height:auto;aspect-ratio:3 / 2;object-fit:cover;border-radius:calc(var(--sf-radius,14px) - 4px)}
.pagecraft-stay-body{min-width:0;display:flex;flex-direction:column;gap:6px}
.pagecraft-stay-where{margin:0;color:var(--sf-accent,#1456A0);font-size:13px;font-weight:600;letter-spacing:.02em}
.pagecraft-stay-name{margin:0;font-size:clamp(20px,2.2vw,24px);font-weight:700;line-height:1.2;letter-spacing:-0.015em;color:var(--sf-ink,#122136)}
.pagecraft-stay-line{margin:0;color:var(--sf-muted,#4E5F78);font-size:15px;line-height:1.55}
.pagecraft-stay-tags{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 0;padding:0;list-style:none}
.pagecraft-stay-tags li{display:inline-flex;align-items:center;padding:4px 11px;border-radius:999px;background:var(--sf-bg,#F4F6FA);border:1px solid var(--sf-line,#D5DFEC);font-size:12.5px;font-weight:600;color:var(--sf-ink,#122136)}
.pagecraft-stay-buy{display:grid;justify-items:end;gap:10px;padding-right:8px}
.pagecraft-stay-price{margin:0;display:grid;justify-items:end;gap:2px}
.pagecraft-stay-price strong{font-size:26px;line-height:1.1;letter-spacing:-0.02em;font-weight:700;font-variant-numeric:tabular-nums;color:var(--sf-ink,#122136)}
.pagecraft-stay-price span{color:var(--sf-muted,#4E5F78);font-size:13px}
.pagecraft-stay-cta{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 20px;border-radius:calc(var(--sf-radius,14px) - 4px);background:var(--sf-accent,#1456A0);color:var(--sf-on,#FFFFFF);font-size:14px;font-weight:600;text-decoration:none;white-space:nowrap;transition:opacity .16s ease}
.pagecraft-stay-cta:hover{opacity:.92}
.pagecraft-stay-empty{margin:14px 0 0;padding:28px;border:1px dashed var(--sf-line,#D5DFEC);border-radius:var(--sf-radius,14px);background:var(--sf-surface,#FFFFFF);color:var(--sf-muted,#4E5F78);font-size:15px;text-align:center}
@media(prefers-reduced-motion:reduce){.pagecraft-stay-step,.pagecraft-stay-sbtn,.pagecraft-stay-cta{transition:none}}
@media(max-width:900px){
  .pagecraft-stay-row{grid-template-columns:1fr;gap:16px}
  .pagecraft-stay-buy{grid-auto-flow:column;justify-content:space-between;align-items:center;padding:8px 4px 2px;border-top:1px solid var(--sf-line,#D5DFEC)}
  .pagecraft-stay-price{justify-items:start}
  .pagecraft-stay-result{margin-left:0}
}
@media(max-width:767px){
  .pagecraft-stay-seasons{width:100%}
  .pagecraft-stay-sbtn{flex:1;min-height:42px;padding:4px 8px;font-size:13px;line-height:1.2;white-space:normal}
}
`;

export const STAYFILTER_JS = `<script>
(function(){
  var disposers=[];
  document.querySelectorAll('[data-stayfilter]').forEach(function(root){
    if(root.hasAttribute('data-pc-sf-ready'))return;
    root.setAttribute('data-pc-sf-ready','1');
    var rows=[].slice.call(root.querySelectorAll('.pagecraft-stay-row'));
    var out=root.querySelector('[data-sf-guests]');
    var result=root.querySelector('[data-sf-result]');
    var empty=root.querySelector('[data-sf-empty]');
    var steps=[].slice.call(root.querySelectorAll('[data-sf-step]'));
    var less=steps[0],more=steps[1];
    var seasons=[].slice.call(root.querySelectorAll('[data-sf-season]'));
    if(!out||!less||!more)return;
    var maxG=Math.max(1,parseInt(root.getAttribute('data-max-guests')||'8',10)||8);
    var guests=Math.min(maxG,Math.max(1,parseInt(root.getAttribute('data-init-guests')||'2',10)||2));
    var sym=root.getAttribute('data-sym')||'$';
    var sing=root.getAttribute('data-singular')||'stay';
    var plur=root.getAttribute('data-plural')||'stays';
    var activeBtn=seasons.find(function(b){return b.getAttribute('aria-checked')==='true';})||seasons[0];
    var season=activeBtn?(activeBtn.getAttribute('data-sf-season')||'mid'):'mid';
    function render(){
      out.textContent=String(guests);
      less.disabled=guests<=1;
      more.disabled=guests>=maxG;
      var shown=0;
      rows.forEach(function(r){
        var cap=parseInt(r.getAttribute('data-sleeps')||'2',10)||2;
        var fit=cap>=guests;
        r.hidden=!fit;
        if(fit)shown++;
        var pOut=r.querySelector('[data-sf-price]');
        var rate=r.getAttribute('data-'+season)||r.getAttribute('data-mid')||'';
        if(pOut&&rate)pOut.textContent=sym+rate;
      });
      if(result)result.textContent=shown+' '+(shown===1?sing:plur);
      if(empty)empty.hidden=shown>0;
    }
    function onLess(){if(guests>1){guests--;render();}}
    function onMore(){if(guests<maxG){guests++;render();}}
    less.addEventListener('click',onLess);
    more.addEventListener('click',onMore);
    var offs=[
      function(){less.removeEventListener('click',onLess);},
      function(){more.removeEventListener('click',onMore);}
    ];
    seasons.forEach(function(btn,idx){
      function onPick(){
        season=btn.getAttribute('data-sf-season')||'mid';
        seasons.forEach(function(x){x.setAttribute('aria-checked',x===btn?'true':'false');});
        render();
      }
      function onKey(e){
        if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
        e.preventDefault();
        var next=seasons[(idx+(e.key==='ArrowRight'?1:-1)+seasons.length)%seasons.length];
        if(next){next.focus();next.click();}
      }
      btn.addEventListener('click',onPick);
      btn.addEventListener('keydown',onKey);
      offs.push(function(){
        btn.removeEventListener('click',onPick);
        btn.removeEventListener('keydown',onKey);
      });
    });
    render();
    disposers.push(function(){
      offs.forEach(function(fn){fn();});
      root.removeAttribute('data-pc-sf-ready');
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
