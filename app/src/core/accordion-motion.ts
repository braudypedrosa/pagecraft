/** Progressive enhancement. Native details remain usable when scripts or animation fail. */
export const ACCORDION_JS = `<script>
(function(){
  if(typeof Element.prototype.animate!=='function')return;
  var media=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
  var groups=[];
  document.querySelectorAll('.pagecraft-accordion').forEach(function(root){
    if(root.hasAttribute('data-pc-accordion-motion'))return;
    var items=Array.from(root.children).filter(function(item){return item.matches('details.pagecraft-accordion-item');});
    if(!items.length)return;
    var single=items.some(function(item){return item.hasAttribute('name');});
    var controls=[];
    root.setAttribute('data-pc-accordion-motion','');
    items.forEach(function(item){
      var summary=item.querySelector(':scope > summary');
      var answer=item.querySelector(':scope > .pagecraft-accordion-a');
      if(!summary||!answer)return;
      var name=item.getAttribute('name');
      var originalHeight=item.style.height,originalOverflow=item.style.overflow;
      var originalInert=answer.getAttribute('inert');
      var expanded=item.open,animation=null;
      // The native group would hide an outgoing answer before its closing transition.
      if(single)item.removeAttribute('name');
      function stop(){
        var previous=animation;animation=null;
        if(previous){previous.onfinish=null;previous.oncancel=null;previous.cancel();}
      }
      function settle(){
        stop();item.open=expanded;
        item.style.height=originalHeight;item.style.overflow=originalOverflow;
        if(originalInert===null)answer.removeAttribute('inert');else answer.setAttribute('inert',originalInert);
      }
      function set(open){
        if(open&&single)controls.forEach(function(other){if(other!==control&&other.expanded())other.set(false);});
        var from=item.getBoundingClientRect().height;
        stop();expanded=open;
        if(!open&&answer.contains(document.activeElement))summary.focus({preventScroll:true});
        if(media&&media.matches){settle();return;}
        if(!open)answer.setAttribute('inert','');else if(originalInert===null)answer.removeAttribute('inert');
        item.style.height=from+'px';item.style.overflow='hidden';item.open=true;
        var style=getComputedStyle(item);
        var border=(parseFloat(style.borderTopWidth)||0)+(parseFloat(style.borderBottomWidth)||0);
        var to=summary.getBoundingClientRect().height+border+(open?answer.getBoundingClientRect().height:0);
        if(Math.abs(to-from)<.5){settle();return;}
        try{
          var current=item.animate([{height:from+'px'},{height:to+'px'}],{
            duration:open?220:180,easing:open?'cubic-bezier(.16,1,.3,1)':'cubic-bezier(.4,0,1,1)'
          });
          animation=current;item.style.height=to+'px';
          current.onfinish=function(){if(animation===current)settle();};
          current.oncancel=function(){if(animation===current)settle();};
        }catch(error){settle();}
      }
      function click(event){
        if(event.defaultPrevented||event.button>0)return;
        if(!animation)expanded=item.open;
        event.preventDefault();set(!expanded);
      }
      function toggle(){
        // Honor native changes, including browser find/reveal and external open updates.
        if(animation){if(!item.open){expanded=false;settle();}return;}
        if(item.open===expanded)return;
        expanded=item.open;
        if(expanded&&single)controls.forEach(function(other){if(other!==control&&other.expanded())other.set(false);});
      }
      var control={set:set,expanded:function(){return expanded;},settle:settle,dispose:function(){
        summary.removeEventListener('click',click);item.removeEventListener('toggle',toggle);settle();
        if(name!==null)item.setAttribute('name',name);
      }};
      controls.push(control);summary.addEventListener('click',click);item.addEventListener('toggle',toggle);
    });
    groups.push({controls:controls,dispose:function(){
      controls.forEach(function(control){control.dispose();});root.removeAttribute('data-pc-accordion-motion');
    }});
  });
  if(!groups.length)return;
  function settleAll(){groups.forEach(function(group){group.controls.forEach(function(control){control.settle();});});}
  function preference(){if(media&&media.matches)settleAll();}
  window.addEventListener('resize',settleAll);
  if(media){if(media.addEventListener)media.addEventListener('change',preference);else if(media.addListener)media.addListener(preference);}
  if(typeof window.__pagecraftRegisterPreviewDispose==='function')window.__pagecraftRegisterPreviewDispose(function(){
    window.removeEventListener('resize',settleAll);
    if(media){if(media.removeEventListener)media.removeEventListener('change',preference);else if(media.removeListener)media.removeListener(preference);}
    groups.forEach(function(group){group.dispose();});
  });
})();
</script>
`;
