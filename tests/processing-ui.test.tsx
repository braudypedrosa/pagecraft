// @vitest-environment jsdom
import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { act } from 'preact/test-utils';
import { render } from 'preact';
import * as C from '../app/src/core/index';
import { L } from '../app/src/ui/ctx';
import { AssetField } from '../app/src/ui/AssetField';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';
let r: Rig;
beforeEach(()=>{r=rig();});
afterEach(()=>{render(null,r.host);r.host.remove();window.__pcFeedback?.destroy();vi.restoreAllMocks();});
const drop=(files:File[])=>{
 const event=new Event('drop',{bubbles:true,cancelable:true});
 Object.defineProperty(event,'dataTransfer',{value:{files}});
 r.$('.imgdrop')!.dispatchEvent(event);
};
for(const surface of ['inspector','CMS/SEO'] as const) test(`${surface} image uploads show progress, block repeats, retain existing values on failure and recover`,async()=>{
 const image=C.insert('image',null,0)!;image.props.src='';
 const change=vi.fn();
 if(surface==='inspector')r.draw(<Ctl n={image} c={{t:'img',k:'src',label:'Image'}}/>);
 else r.draw(<AssetField value="" onChange={change}/>);
 let fail!:(e:Error)=>void;
 L.mediaTake=vi.fn(()=>new Promise<string|null>((_,reject)=>{fail=reject;}));
 const file=new File(['test'],'upload.png',{type:'image/png'});
 await act(()=>{drop([file]);drop([file]);});
 expect(L.mediaTake).toHaveBeenCalledTimes(1);
 expect(r.$('button[aria-busy=true]')?.textContent).toContain('Uploading');
 expect(document.querySelector('[data-tone=progress]')?.textContent).toContain('upload.png');
 await act(async()=>{fail(new Error('Disconnected'));});
 expect(change).not.toHaveBeenCalled();expect(image.props.src).toBe('');
 await vi.waitFor(()=>expect(r.$('button[aria-busy="true"]')).toBeNull());
 expect(document.querySelector('[role=alert]')?.textContent).toContain('Could not upload upload.png');
 L.asset=()=>({url:'blob:test',name:'upload.png',size:100,w:100,h:80});
 L.mediaTake=vi.fn(async()=> 'uploaded');
 await act(async()=>drop([file]));
 await vi.waitFor(()=>expect(document.querySelector('[data-tone=success]')).not.toBeNull());
 expect(document.querySelectorAll('.pc-notification')).toHaveLength(1);
 expect(document.querySelector('[data-tone=success]')?.textContent).toContain('Image uploaded.');
 if(surface==='inspector')expect(image.props.src).toBe('asset:uploaded');
 else expect(change).toHaveBeenCalledWith('asset:uploaded');
});

test('a partial gallery upload keeps successful files in one undo step and identifies files to retry',async()=>{
 const gallery=C.insert('gallery',null,0)!;gallery.props.items=[];
 let input!:HTMLInputElement;
 vi.spyOn(HTMLInputElement.prototype,'click').mockImplementation(function(this:HTMLInputElement){input=this;});
 L.asset=()=>({url:'blob:test',name:'ok.png',size:50});
 L.mediaTake=vi.fn(async file=>{if(file.name==='failed.png')throw new Error('Offline');return file.name;});
 r.draw(<Ctl n={gallery} c={{t:'imgs',k:'items',label:'Gallery'}}/>);
 const undo=C.hist.u.length;
 await act(()=>r.click(r.$$('button').find(b=>b.textContent?.includes('Upload'))!));
 Object.defineProperty(input,'files',{value:[new File(['x'],'first.png'),new File(['x'],'failed.png'),new File(['x'],'last.png')]});
 await act(async()=>{input.dispatchEvent(new Event('change'));});
 await vi.waitFor(()=>expect(document.querySelector('[role=alert]')).not.toBeNull());
 expect((gallery.props.items as any[]).map(v=>v.src)).toEqual(['asset:first.png','asset:last.png']);
 expect(C.hist.u.length).toBe(undo+1);
 expect(document.querySelector('[role=alert]')?.textContent).toContain('2 uploaded. Could not upload failed.png');
 expect(document.querySelector('[data-tone=success]')).toBeNull();
});

test('image dimension lookup waits for its result and restores Detect after failure and success',async()=>{
 const image=C.insert('image',null,0)!;image.props.src='asset:test';
 let resolve!:(v:null)=>void;
 L.imgSize=vi.fn(()=>new Promise<null>(yes=>{resolve=yes;}));
 r.draw(<Ctl n={image} c={{t:'dims',label:'Dimensions'}}/>);
 const button=r.$('button')!;
 await act(()=>{r.click(button);r.click(button);});
 expect(L.imgSize).toHaveBeenCalledTimes(1);
 expect(button.textContent).toBe('Reading…');
 await act(async()=>resolve(null));
 await vi.waitFor(()=>expect(button.textContent).toBe('Detect'));
 expect(document.querySelector('[role=alert]')?.textContent).toContain('Could not read that image');
 L.imgSize=async()=>({w:960,h:640});
 await act(async()=>r.click(button));
 await vi.waitFor(()=>expect(document.querySelector('[data-tone=success]')).not.toBeNull());
 expect(image.props.w).toBe('960');expect(image.props.h).toBe('640');
 expect(document.querySelector('[data-tone=success]')?.textContent).toContain('Detected 960 × 640.');
});
