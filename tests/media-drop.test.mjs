import {afterEach, expect, test, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {JSDOM, VirtualConsole} from 'jsdom';

const windows=[];
afterEach(()=>{for(const dom of windows.splice(0)){dom.window.__pcFeedback?.destroy();dom.window.close();}});
async function setup(){
  const dom=new JSDOM(readFileSync('index.html','utf8'),{
    url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:new VirtualConsole()
  });
  windows.push(dom);
  const w=dom.window,d=w.document;
  await vi.waitFor(()=>expect(w.__CORE?.state.pages.length).toBeGreaterThan(0));
  w.writeNow=vi.fn();
  w.assetAdd=vi.fn(async file=>{
    const id='qa-'+w.assetAdd.mock.calls.length;
    w.eval('AS').mem.set(id,{id,name:file.name,size:file.size,w:1,h:1,url:'data:image/png;base64,AA=='});
    return id;
  });
  w.mediaModal();
  const file=(name='qa-drop.png',type='image/png')=>new w.File(['image bytes'],name,{type});
  const drag=(target,type,files=[],types=['Files'])=>{
    const e=new w.Event(type,{bubbles:true,cancelable:true});
    Object.defineProperty(e,'dataTransfer',{value:{files,types,dropEffect:'none'}});
    target.dispatchEvent(e);return e;
  };
  return {w,d,file,drag,zone:()=>d.querySelector('.media-library-drop')};
}

test('file drag highlights the whole empty body, survives child transitions, and clears on leave',async()=>{
  const {d,drag,zone}=await setup(),z=zone(),child=d.querySelector('.media-library-items');
  expect(d.querySelector('#mBody').textContent).toContain('Drop images here');
  expect(drag(z,'dragenter',[],['text/plain']).defaultPrevented).toBe(false);
  expect(z.classList.contains('over')).toBe(false);
  expect(drag(z,'dragenter').defaultPrevented).toBe(true);
  drag(child,'dragenter');drag(child,'dragleave');
  expect(z.classList.contains('over')).toBe(true);
  expect(drag(z,'dragover').dataTransfer.dropEffect).toBe('copy');
  drag(z,'dragleave');expect(z.classList.contains('over')).toBe(false);
});

test('multiple dropped images use one batch, reject duplicate drops, and redraw populated cards',async()=>{
  const {w,d,file,drag,zone}=await setup();
  let release;
  const original=w.assetAdd;
  w.assetAdd=vi.fn(async f=>{await new Promise(resolve=>{release=resolve});return original(f);});
  const z=zone();drag(z,'dragenter');drag(z,'drop',[file('first.png'),file('second.png')]);
  expect(z.classList.contains('over')).toBe(false);
  expect(z.getAttribute('aria-busy')).toBe('true');
  expect(d.querySelector('#mmUp').disabled).toBe(true);
  expect(drag(z,'dragover').dataTransfer.dropEffect).toBe('none');
  drag(z,'drop',[file('duplicate.png')]);expect(w.assetAdd).toHaveBeenCalledTimes(1);
  release();await vi.waitFor(()=>expect(w.assetAdd).toHaveBeenCalledTimes(2));release();
  await vi.waitFor(()=>expect(d.querySelectorAll('.mcard')).toHaveLength(2));
  expect(w.writeNow).toHaveBeenCalledTimes(2);
  expect(d.querySelector('#mmUp').disabled).toBe(false);
  expect(d.querySelector('[data-tone=success]').textContent).toContain('2 images uploaded');
  expect(zone()).not.toBe(z);
  // A redraw owns a fresh listener set; dropping over a thumbnail uploads only once.
  w.assetAdd=original;drag(d.querySelector('.mthumb'),'drop',[file('third.png')]);
  await vi.waitFor(()=>expect(d.querySelectorAll('.mcard')).toHaveLength(3));
});

test('invalid files and empty directory drops show recoverable errors without uploading',async()=>{
  const {w,d,file,drag,zone}=await setup();
  drag(zone(),'drop',[]);
  expect(d.querySelector('[data-tone=error]').textContent).toContain('Folders are not supported');
  drag(zone(),'drop',[file('notes.txt','text/plain')]);
  await vi.waitFor(()=>expect(d.querySelector('#mmUp').disabled).toBe(false));
  expect(w.assetAdd).not.toHaveBeenCalled();
  expect(d.querySelector('#pc-notifications').textContent).toContain('Could not upload notes.txt');
  drag(zone(),'drop',[file('retry.png')]);
  await vi.waitFor(()=>expect(d.querySelectorAll('.mcard')).toHaveLength(1));
});

test('Upload chooses multiple images through the same path and canceled chooser is quiet',async()=>{
  const {w,d,file}=await setup();
  let chosen;
  const click=w.HTMLInputElement.prototype.click;
  w.HTMLInputElement.prototype.click=function(){chosen=this;};
  d.querySelector('#mmUp').click();
  expect(chosen).toBeUndefined();
  d.querySelector('[data-media-choose]').click();
  expect(chosen.accept).toBe('image/*');expect(chosen.multiple).toBe(true);
  chosen.dispatchEvent(new w.Event('change'));expect(w.assetAdd).not.toHaveBeenCalled();
  Object.defineProperty(chosen,'files',{value:[file('chosen.png')]});
  chosen.dispatchEvent(new w.Event('change'));
  await vi.waitFor(()=>expect(d.querySelector('.mname').textContent).toBe('chosen.png'));
  w.HTMLInputElement.prototype.click=click;
});

test('completed uploads do not reopen a closed library or replace another dialog',async()=>{
  const {w,d,file,drag,zone}=await setup();
  let release;w.assetAdd=vi.fn(()=>new Promise(resolve=>{release=resolve}));
  drag(zone(),'drop',[file()]);d.querySelector('#mmDone').click();
  w.openModal('Another dialog','Keep this content');release('qa-file');
  await vi.waitFor(()=>expect(d.querySelector('[data-tone=success]')).not.toBeNull());
  expect(d.querySelector('#mTitle').textContent).toBe('Another dialog');
  expect(d.querySelector('#mBody').textContent).toBe('Keep this content');
  expect(d.querySelector('.media-library-drop')).toBeNull();
});

test('both browser surfaces search without replacing the focused field and filter immediately',async()=>{
  const {w,d}=await setup();
  const assets=w.eval('AS').mem;
  assets.set('one',{id:'one',name:'Alpha.png',size:10,url:'data:image/png;base64,AA=='});
  assets.set('two',{id:'two',name:'Zebra.png',size:50,url:'data:image/png;base64,AA=='});
  w.assetUsage=()=>({one:1});
  for(const picker of [false,true]){
    if(picker) w.mediaPicker(); else w.mediaModal();
    const root=d.querySelector(picker?'#askBody':'#mBody');
    const search=root.querySelector('[data-media-search]');search.focus();
    search.value=' ZEB ';search.dispatchEvent(new w.Event('input',{bubbles:true}));
    expect(d.activeElement).toBe(search);
    expect(root.querySelectorAll('.mcard')).toHaveLength(1);
    expect(root.querySelector('.mname').textContent).toBe('Zebra.png');
    search.value='';search.dispatchEvent(new w.Event('input',{bubbles:true}));
    const usage=root.querySelector('[data-media-usage]');usage.value='used';usage.dispatchEvent(new w.Event('change',{bubbles:true}));
    expect(root.querySelector('.mname').textContent).toBe('Alpha.png');
    usage.value='all';usage.dispatchEvent(new w.Event('change',{bubbles:true}));
    const sort=root.querySelector('[data-media-sort]');sort.value='size';sort.dispatchEvent(new w.Event('change',{bubbles:true}));
    expect(root.querySelector('.mname').textContent).toBe('Zebra.png');
    if(picker) w.askClose(null);
  }
});

test('large libraries render bounded batches and recover from an empty search',async()=>{
  const {w,d}=await setup();const assets=w.eval('AS').mem;
  for(let i=0;i<150;i++) assets.set(String(i),{id:String(i),name:`Photo ${i}.png`,size:i,url:'data:image/png;base64,AA=='});
  w.mediaModal();expect(d.querySelectorAll('.mcard')).toHaveLength(60);
  d.querySelector('[data-media-more]').click();expect(d.querySelectorAll('.mcard')).toHaveLength(120);
  const search=d.querySelector('[data-media-search]');search.value='nothing matches';search.dispatchEvent(new w.Event('input'));
  expect(d.querySelectorAll('.mcard')).toHaveLength(0);
  expect(d.querySelector('.media-browser-results').textContent).toContain('No matching');
  search.value='';search.dispatchEvent(new w.Event('input'));expect(d.querySelectorAll('.mcard')).toHaveLength(60);
});

test('a failed host upload returning no ID is reported and can be retried',async()=>{
  const {w,d,file,drag,zone}=await setup();w.assetAdd=vi.fn(async()=>null);
  drag(zone(),'drop',[file('failed.png')]);
  await vi.waitFor(()=>expect(d.querySelector('#pc-notifications').textContent).toContain('Could not upload failed.png'));
  expect(d.querySelector('#mmUp').disabled).toBe(false);
});

test('upload refresh does not replay the open modal entrance',async()=>{
  const {w,d,file,drag,zone}=await setup();
  const motion=w.PC_UI.installUiMotion();
  const enter=vi.spyOn(motion,'enter');
  drag(zone(),'drop',[file('qa-modal-refresh.png')]);
  await vi.waitFor(()=>expect(d.querySelector('.mname')?.textContent).toBe('qa-modal-refresh.png'));
  expect(enter.mock.calls.filter(([node])=>node.id==='modal'||node.id==='modalBox')).toHaveLength(0);
  enter.mockRestore();
});
