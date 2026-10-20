import {test,expect,vi} from 'vitest';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setImmediate as yieldToIo} from 'node:timers/promises';
import sharp from 'sharp';
import {captureGallerySteps} from '../tools/capture-ui-gallery.mjs';
import {names} from '../tools/ui-gallery-contract.mjs';

const behaviorChecks=[{host:'cloud',check:'gallery ready',passed:true}];

const driveNext=async iterator=>{
 const pending=iterator.next();
 let settled=false;
 pending.then(()=>{settled=true;},()=>{settled=true;});
 while(!settled){
  await yieldToIo();
  if(vi.getTimerCount())await vi.runOnlyPendingTimersAsync();
 }
 return pending;
};

const galleryHarness=async()=>{
 const screenshotCalls=[],waitOptions=[],cleanupCalls=[];
 let host='cloud';
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer();
 const runtime={userAgent:'Chrome',platform:'MacIntel',userAgentData:{supported:false},devicePixelRatio:1,visualViewportScale:1,screen:{width:1440,height:900,availWidth:1440,availHeight:900,colorDepth:24,pixelDepth:24},colorGamut:{srgb:true,p3:false,rec2020:false},dynamicRange:{standard:true,high:false},colorScheme:{light:true,dark:false}};
 const cdp={send:async(method,params)=>{
  if(method==='Runtime.evaluate')return params.expression.startsWith('JSON.stringify')?{result:{value:JSON.stringify(runtime)}}:{result:{value:'loaded'}};
  if(method==='Page.getLayoutMetrics')return {cssContentSize:{height:900}};
  if(method==='Page.captureScreenshot'){screenshotCalls.push(structuredClone(params));return {data:png.toString('base64')};}
  if(method==='Browser.getVersion'||method==='Browser.getBrowserCommandLine'||method==='SystemInfo.getInfo')throw new Error('unsupported');
  if(method==='Emulation.clearDeviceMetricsOverride'||method==='Emulation.setEmulatedMedia'&&params.features?.length===0)cleanupCalls.push(method);
  return {};
 }};
 const tab={
  capabilities:{get:async()=>cdp},
  playwright:{
   evaluate:async(fn,arg)=>{
    if(arg)return {x:0,y:0,width:100,height:30};
    const source=String(fn);
    if(source.includes('galleryHost'))return host;
    if(source.includes('galleryReady'))return 'true';
    return {width:1440,innerHeight:900,scrollHeight:900,scrollWidth:1440,fonts:'loaded'};
   },
   getByRole:(_role,{name})=>({click:async()=>{if(name==='Cloud')host='cloud';if(name==='Builder')host='builder';}}),
   locator:()=>({waitFor:async options=>{waitOptions.push(options);},press:async()=>{},click:async()=>{}}),
  },
  pressKey:async()=>{},
 };
 return {tab,screenshotCalls,waitOptions,cleanupCalls};
};

test('captureGallerySteps yields each saved PNG and writes the manifest only at completion',async()=>{
 vi.useFakeTimers({toFake:['setTimeout']});
 const directory=await mkdtemp(join(tmpdir(),'pagecraft-capture-steps-'));
 try{
  const harness=await galleryHarness(),iterator=captureGallerySteps(harness.tab,directory,behaviorChecks),progress=[];
  for(let index=0;index<names.length;index++){
   const step=await driveNext(iterator);
   expect(step.done).toBe(false);
   progress.push(step.value);
   expect(step.value).toMatchObject({index:index+1,total:names.length,screenshots:index+1,directory});
   expect(await readdir(directory)).not.toContain('capture.json');
  }
  const done=await driveNext(iterator);
  expect(done).toEqual({done:true,value:{screenshots:names.length,directory}});
  expect(progress.map(({name})=>name).sort()).toEqual([...names].sort());
  expect((await readdir(directory)).filter(name=>name.endsWith('.png'))).toHaveLength(names.length);
  expect(await readFile(join(directory,'capture.json'),'utf8')).toContain('"captureSchemaVersion": 2');
  expect(harness.waitOptions.filter(options=>options.timeoutMs===10000)).toHaveLength(27);
 }finally{
  vi.useRealTimers();
  await rm(directory,{recursive:true,force:true});
 }
},30000);

test('captureGallerySteps cancellation restores CDP state without writing a manifest',async()=>{
 vi.useFakeTimers({toFake:['setTimeout']});
 const directory=await mkdtemp(join(tmpdir(),'pagecraft-capture-cancel-'));
 try{
  const harness=await galleryHarness(),iterator=captureGallerySteps(harness.tab,directory,behaviorChecks);
  const first=await driveNext(iterator);
  expect(first.value.index).toBe(1);
  await iterator.return();
  expect(harness.cleanupCalls).toEqual(['Emulation.clearDeviceMetricsOverride','Emulation.setEmulatedMedia']);
  expect(await readdir(directory)).not.toContain('capture.json');
 }finally{
  vi.useRealTimers();
  await rm(directory,{recursive:true,force:true});
 }
},30000);
