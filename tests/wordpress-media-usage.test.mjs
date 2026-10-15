import {afterEach, expect, test, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';

const source=readFileSync('builder.html','utf8');
const windows=[];
afterEach(()=>windows.splice(0).forEach(window=>window.close()));

function harness({wordpress=true,document={pages:[]},remove=vi.fn(async()=>{}),confirm=vi.fn(async()=>true)}={}){
  const success=vi.fn(),error=vi.fn(),toast=vi.fn(),askConfirm=confirm;
  const context={
    IS_WORDPRESS:wordpress,AS:{mem:new Map()},SRV:wordpress?{siteId:'wp'}:{siteId:'cloud'},
    HOST:{assets:{remove}},feedback:()=>({begin:()=>({success,error})}),toast,askConfirm,
    A_RE:/asset:([A-Za-z0-9][A-Za-z0-9._:-]*)(?:@\d+)?/g,doc:()=>document,
    idbReq:vi.fn(),idbStore:vi.fn(),URL:{revokeObjectURL:vi.fn()},
    esc:value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
    JSON,Number,Math,Map,Set,String,Error,Object,Array,Promise,
  };
  vm.createContext(context);
  const start=source.indexOf('const deletingAssets =');
  const end=source.indexOf('\n/* intrinsic pixel size',start);
  expect(start).toBeGreaterThan(-1);expect(end).toBeGreaterThan(start);
  vm.runInContext(source.slice(start,end)+'\nthis.assetDeleteSummary=assetDeleteSummary;',context);
  return {context,remove,success,error,toast,askConfirm};
}

const media=(id,extra={})=>({
  id,name:id+'.jpg',url:'https://wp.test/uploads/'+id+'.jpg',usageKnown:true,
  usageCount:0,canDelete:true,usedBy:[],...extra,
});

test('WordPress deletion joins site-wide usage with unsaved token and exact-URL references',()=>{
  const document={pages:[
    {tree:[{props:{src:'asset:token'}}]},
    {tree:[{props:{src:'https://wp.test/uploads/url.jpg'}},{props:{src:'https://wp.test/uploads/near.jpg?size=large'}},
      {props:{html:'<img src="https://wp.test/uploads/markup.jpg" alt="">'}},
      {props:{text:'https://wp.test/uploads/prefix.jpg2'}}]},
  ]};
  const {context}=harness({document});
  context.AS.mem.set('remote',media('remote',{usageCount:1,canDelete:false,usedBy:[{
    id:'88',type:'page',title:'Other page',status:'publish',parentId:null,references:['featured_image'],
  }]}));
  context.AS.mem.set('token',media('token'));
  context.AS.mem.set('url',media('url'));
  context.AS.mem.set('near',media('near'));
  context.AS.mem.set('markup',media('markup'));
  context.AS.mem.set('prefix',media('prefix'));
  context.AS.mem.set('free',media('free'));
  context.AS.mem.set('unknown',media('unknown',{usageKnown:false,usageCount:null,canDelete:false}));

  const local=context.assetUsage();
  expect({...local}).toEqual({token:1,url:1,near:1,markup:1});
  expect(context.assetUse('remote',local)).toMatchObject({known:true,serverCount:1,localCount:0,used:true,canDelete:false});
  expect(context.assetUse('token',local)).toMatchObject({serverCount:0,localCount:1,used:true,canDelete:false});
  expect(context.assetUse('url',local)).toMatchObject({localCount:1,canDelete:false});
  expect(context.assetUse('near',local)).toMatchObject({localCount:1,canDelete:false});
  expect(context.assetUse('markup',local)).toMatchObject({localCount:1,canDelete:false});
  expect(context.assetUse('prefix',local)).toMatchObject({localCount:0,canDelete:true});
  expect(context.assetUse('free',local)).toMatchObject({used:false,canDelete:true});
  expect(context.assetUse('unknown',local)).toMatchObject({known:false,used:false,canDelete:false});
});

test('inconsistent WordPress usage never becomes deletable',()=>{
  const {context}=harness();
  context.AS.mem.set('positive-delete',media('positive-delete',{usageCount:1,canDelete:true,usedBy:[]}));
  context.AS.mem.set('hidden-use',media('hidden-use',{usageCount:1,canDelete:false,usedBy:[]}));
  context.AS.mem.set('zero-with-rows',media('zero-with-rows',{usageCount:0,canDelete:true,usedBy:[{
    id:'42',type:'page',title:'Home',status:'publish',parentId:null,references:['native_content'],
  }]}));
  for(const id of ['positive-delete','hidden-use','zero-with-rows']) {
    expect(context.assetUse(id)).toMatchObject({known:false,canDelete:false});
  }
});

test('WordPress single and prune deletion confirmations state permanence',async()=>{
  const {context,askConfirm}=harness();
  context.AS.mem.set('unsafe-name',media('unsafe-name',{name:'A < B.jpg'}));
  await expect(context.confirmWordPressAssetDelete(['unsafe-name'])).resolves.toBe(true);
  await expect(context.confirmWordPressAssetDelete(['unsafe-name'],true)).resolves.toBe(true);
  expect(askConfirm.mock.calls[0]).toEqual(['Delete this image?',
    'Permanently delete <b>A &lt; B.jpg</b> from the WordPress media library? This cannot be undone.',
    {ok:'Delete image',danger:true}]);
  expect(askConfirm.mock.calls[1]).toEqual(['Remove unused images?',
    'Permanently delete 1 unused image from the WordPress media library? This cannot be undone.',
    {ok:'Delete unused images',danger:true}]);
});

test('a repeated click cannot open concurrent permanent-delete confirmations',async()=>{
  let finish;
  const confirm=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
  const {context}=harness({confirm});
  context.AS.mem.set('photo',media('photo'));
  const first=context.confirmWordPressAssetDelete(['photo']);
  await expect(context.confirmWordPressAssetDelete(['photo'])).resolves.toBe(false);
  expect(confirm).toHaveBeenCalledTimes(1);
  finish(true);
  await expect(first).resolves.toBe(true);
});

test('Cloud keeps document-only deletion behavior when host usage fields are absent',()=>{
  const {context}=harness({wordpress:false,document:{image:'asset:used'}});
  context.AS.mem.set('used',{id:'used',url:'https://cloud.test/used.jpg'});
  context.AS.mem.set('free',{id:'free',url:'https://cloud.test/free.jpg'});
  expect(context.assetUse('used')).toMatchObject({known:true,used:true,canDelete:false});
  expect(context.assetUse('free')).toMatchObject({known:true,used:false,canDelete:true});
});

test('unknown WordPress usage blocks a single delete without calling the host',async()=>{
  const {context,remove,error}=harness();
  context.AS.mem.set('legacy',media('legacy',{usageKnown:false,usageCount:null,canDelete:false}));
  await expect(context.assetDel('legacy',{})).resolves.toBe(false);
  expect(remove).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledWith(expect.stringContaining('could not be checked'));
  expect(context.AS.mem.has('legacy')).toBe(true);
});

test('a stale WordPress delete refusal refreshes authoritative usage and stays retryable',async()=>{
  const refusal=Object.assign(new Error('Conflict'),{status:409,payload:{
    code:'pagecraft_media_in_use',error:'This image is used by WordPress content and cannot be deleted.',
    usageKnown:true,usageCount:2,canDelete:false,usedBy:[{
      id:'91',type:'page',title:'Services',status:'publish',parentId:null,references:['native_content'],
    }],
  }});
  const {context,error}=harness({remove:vi.fn(async()=>{throw refusal;})});
  context.AS.mem.set('stale',media('stale'));
  await expect(context.assetDel('stale',{})).resolves.toBe(false);
  expect(context.assetUse('stale')).toMatchObject({known:true,serverCount:2,used:true,canDelete:false});
  expect(context.AS.mem.get('stale').usedBy[0].title).toBe('Services');
  expect(error).toHaveBeenCalledWith('This image is used by WordPress content and cannot be deleted.');
});

test('bulk and prune helper reports removed, still-used and failed assets without false success',async()=>{
  const remove=vi.fn(async id=>{if(id==='network')throw new Error('Offline');});
  const {context,toast}=harness({document:{current:'asset:local'},remove});
  context.AS.mem.set('free',media('free'));
  context.AS.mem.set('network',media('network'));
  context.AS.mem.set('remote',media('remote',{usageCount:1,canDelete:false,usedBy:[{
    id:'88',type:'page',title:'Other page',status:'publish',parentId:null,references:['managed_document'],
  }]}));
  context.AS.mem.set('local',media('local'));
  context.AS.mem.set('unknown',media('unknown',{usageKnown:false,usageCount:null,canDelete:false}));

  const result=await context.assetDeleteMany(['free','network','remote','local','unknown']);
  expect({...result}).toEqual({removed:1,blocked:2,failed:2});
  expect(context.assetDeleteSummary(result)).toBe('1 removed · 2 still used · 2 failed');
  expect(context.assetDeleteSummary({removed:0,blocked:0,failed:2})).toBe('0 removed · 0 still used · 2 failed');
  expect([...context.AS.mem.keys()].sort()).toEqual(['local','network','remote','unknown']);
  expect(remove.mock.calls.map(([id])=>id)).toEqual(['free','network']);
  expect(toast).not.toHaveBeenCalled();
});

test('details distinguish current draft locations from site-wide WordPress usage',()=>{
  const dom=new JSDOM('<div id="root"><div data-media-details hidden></div></div>');
  windows.push(dom.window);
  const document={one:'asset:photo',two:'https://wp.test/uploads/photo.jpg'};
  const {context}=harness({document});
  const asset=media('photo',{usageCount:2,canDelete:false,usedBy:[{
    id:'42',type:'page',title:'Published home',status:'publish',parentId:null,
    references:['managed_document','featured_image'],
  }]});
  context.AS.mem.set('photo',asset);
  Object.assign(context,{
    document:dom.window.document,
    $:(selector,root=dom.window.document)=>root.querySelector(selector),
    $$:(selector,root=dom.window.document)=>[...root.querySelectorAll(selector)],
    mediaReferences:()=>[{assetId:'photo',scope:'page',label:'Current page'}],
    esc:value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
    kb:value=>value+' B',HOST:{assets:{}},PC_UI:{installUiMotion:()=>null},
    mediaReplace:vi.fn(),mediaOpenReference:vi.fn(),Date,
  });
  const start=source.indexOf('function mediaDetails(');
  const end=source.indexOf('\n/* Pin the reviewed draft',start);
  vm.runInContext(source.slice(start,end),context);
  context.mediaDetails(dom.window.document.querySelector('#root'),'photo',vi.fn(),null);
  const text=dom.window.document.querySelector('[data-media-details]').textContent;
  expect(text).toContain('Current draft: 2 references');
  expect(text).toContain('1 managed location shown below');
  expect(text).toContain('Saved WordPress content: 2 references across 1 item');
  expect(text).toContain('Published home · publish · Pagecraft document, Featured image');
});
