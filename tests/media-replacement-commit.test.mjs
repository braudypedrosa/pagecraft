import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../app/src/core/index.ts';
const source=readFileSync('builder.html','utf8');
function setup(save=vi.fn(async()=>({version:8}))){
 C.seed();C.blankProject('Replacement QA');
 const document=structuredClone(C.doc());document.pages[0].tree=[C.N('image',{src:'asset:old'})];
 const undo=[];
 const context={saving:false,saveAgain:false,saveState:'ok',lastCloudDocument:'',SRV:{version:7},HOST:{assets:{retainsHistory:true},documents:{save}},state:structuredClone(document),JSON,Error,Promise,setTimeout,replaceMediaReferences:C.replaceMediaReferences,stamp:vi.fn(),writeNow:vi.fn()};
 context.doc=()=>({meta:context.state.meta,pages:context.state.pages,header:context.state.header,footer:context.state.footer});
 context.edit=fn=>{undo.push(structuredClone(context.doc()));fn();};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function mediaReplaceCommit('),source.indexOf('async function mediaReplace(id)')),context);
 return {context,save,undo,baseline:JSON.stringify(context.doc())};
}
test('replacement saves the pinned version before one undoable document adoption',async()=>{
 const {context,save,undo,baseline}=setup();await context.mediaReplaceCommit('old','new',baseline);
 expect(save).toHaveBeenCalledWith({document:expect.any(Object),version:7});
 expect(context.state.pages[0].tree[0].props.src).toBe('asset:new');expect(undo).toHaveLength(1);
 expect(undo[0].pages[0].tree[0].props.src).toBe('asset:old');expect(context.SRV.version).toBe(8);
});
test('stale server version leaves the document and Undo unchanged',async()=>{
 const {context,undo,baseline}=setup(vi.fn(async()=>{throw new Error('Conflict');}));
 await expect(context.mediaReplaceCommit('old','new',baseline)).rejects.toThrow('Conflict');
 expect(JSON.stringify(context.doc())).toBe(baseline);expect(undo).toHaveLength(0);expect(context.saving).toBe(false);
});
test('local edits after preview reject replacement before writing',async()=>{
 const {context,save,undo,baseline}=setup();context.state.pages[0].name='Changed';
 await expect(context.mediaReplaceCommit('old','new',baseline)).rejects.toThrow('draft changed');expect(save).not.toHaveBeenCalled();expect(undo).toHaveLength(0);
});
test('hosts without retained bytes never write replacements',async()=>{
 const {context,save,baseline}=setup();context.HOST.assets.retainsHistory=false;
 await expect(context.mediaReplaceCommit('old','new',baseline)).rejects.toThrow('host');expect(save).not.toHaveBeenCalled();
});
