import {test,expect,vi} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {captureCodeHashes,names,validateCaptureEvidence} from '../tools/ui-baselines.mjs';
import {captureGallery,captureScreenshotWithProvenance} from '../tools/capture-ui-gallery.mjs';
import {pngColorMetadata} from '../tools/png-color-metadata.mjs';

const behaviorChecks=[{host:'cloud',check:'gallery ready',passed:true}];
const captures=Object.fromEntries(names.map(name=>{
 const width=Number(name.match(/-(\d+)\.png$/)[1]),height=900;
 const screenshot={format:'png',fromSurface:true,captureBeyondViewport:false,optimizeForSpeed:false,clip:{x:0,y:0,width,height,scale:1}};
 return [name,{state:'reviewed',width,height,overflow:false,fonts:'loaded',captureParameters:{metricsOverride:{width,height,deviceScaleFactor:1,mobile:false,scale:1},screenshot},pngColorMetadata:{signature:'a'.repeat(64)}}];
}));
const currentEvidence=()=>({
 captureSchemaVersion:2,
 captureCode:{'tools/capture-ui-gallery.mjs':'a'.repeat(64),'tools/png-color-metadata.mjs':'b'.repeat(64)},
 browser:'Codex In-app Browser',
 browserVersion:{supported:true,value:{protocolVersion:'1.3',product:'Chrome/140',revision:'r1',userAgent:'Chrome',jsVersion:'14'}},
 captureEnvironment:{
  runtime:{userAgent:'Chrome',platform:'MacIntel',userAgentData:{supported:false},devicePixelRatio:1,visualViewportScale:1,screen:{colorDepth:24,pixelDepth:24},colorGamut:{srgb:true,p3:true,rec2020:false},dynamicRange:{standard:true,high:false}},
  browserCommandLine:{supported:false},
  systemInfo:{supported:false},
 },
 captureRecipe:{metrics:{deviceScaleFactor:1,mobile:false,scale:1},screenshot:{format:'png',fromSurface:true,captureBeyondViewport:false,optimizeForSpeed:false,clipScale:1},settling:{fontsReady:true,animationFrames:2,heightRemeasure:true,maxHeightAttempts:3},provenanceViewport:{width:1440,height:900,deviceScaleFactor:1}},
 deviceScaleFactor:1,
 viewportHeight:900,
 reducedMotion:true,
 behaviorChecks,
 captures:structuredClone(captures),
});

test('capture schema 2 requires deterministic provenance and consistent capture parameters',()=>{
 expect(validateCaptureEvidence(currentEvidence()).captureSchemaVersion).toBe(2);
 const missingVersion=currentEvidence();delete missingVersion.browserVersion.value.revision;
 expect(()=>validateCaptureEvidence(missingVersion)).toThrow('complete Browser.getVersion provenance when supported');
 const missingCaptureCode=currentEvidence();delete missingCaptureCode.captureCode['tools/png-color-metadata.mjs'];
 expect(()=>validateCaptureEvidence(missingCaptureCode)).toThrow('capture-code hashes');
 const missingOptionalStatus=currentEvidence();delete missingOptionalStatus.captureEnvironment.runtime.userAgentData;
 expect(()=>validateCaptureEvidence(missingOptionalStatus)).toThrow('runtime and color characteristics');
 const inconsistent=currentEvidence();inconsistent.captures[names[0]].captureParameters.screenshot.fromSurface=false;
 expect(()=>validateCaptureEvidence(inconsistent)).toThrow(`parameters are inconsistent for ${names[0]}`);
});

test('capture schema 2 accepts explicit Browser.getVersion rejection without guessing version fields',()=>{
 const evidence=currentEvidence();evidence.browserVersion={supported:false};evidence.declaredBrowserVersion={value:'Codex built-in browser',verified:false};
 expect(validateCaptureEvidence(evidence).browserVersion).toEqual({supported:false});
});

test('legacy reviewed evidence remains valid without schema 2 provenance',()=>{
 expect(validateCaptureEvidence({browser:'Codex In-app Browser',deviceScaleFactor:1,viewportHeight:900,reducedMotion:true,behaviorChecks,captures:Object.fromEntries(names.map(name=>[name,{state:'reviewed'}]))}).captureSchemaVersion).toBeUndefined();
});

test('PNG color metadata is recorded without changing image bytes',async()=>{
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer(),before=Buffer.from(png),metadata=pngColorMetadata(png);
 expect(metadata.signature).toMatch(/^[a-f0-9]{64}$/);
 expect(metadata.chunks).toEqual({iCCP:[],sRGB:[],gAMA:[],cHRM:[]});
 expect(png).toEqual(before);
});

test('capture code hashes cover the dependency-light built-in capture path',async()=>{
 const hashes=await captureCodeHashes();
 expect(Object.keys(hashes).sort()).toEqual(['tools/capture-ui-gallery.mjs','tools/png-color-metadata.mjs']);
 expect(Object.values(hashes).every(value=>/^[a-f0-9]{64}$/.test(value))).toBe(true);
});

const screenshotParams={format:'png',fromSurface:true,captureBeyondViewport:true,optimizeForSpeed:false,clip:{x:0,y:0,width:1440,height:900,scale:1}};

test('screenshot provenance records a direct success without touching accessibility state',async()=>{
 const calls=[],cdp={send:async(method,params)=>{calls.push([method,params]);return {data:'direct'};}},tab={getAXState:async()=>{throw new Error('must not run');}};
 const captured=await captureScreenshotWithProvenance(tab,cdp,screenshotParams);
 expect(captured).toEqual({result:{data:'direct'},provenance:{path:'direct',directAttempt:{outcome:'success'},axFallback:{used:false}}});
 expect(calls).toEqual([['Page.captureScreenshot',screenshotParams]]);
});

test('screenshot provenance records the actual error, AX fallback and successful retry without secrets',async()=>{
 const calls=[],ax=[],responses=[new Error('Denied https://user:pass@private.example.test/path?token=raw token=also-raw'),{data:'retry'}];
 const cdp={send:async(method,params)=>{calls.push([method,params]);const response=responses.shift();if(response instanceof Error)throw response;return response;}};
 const tab={getAXState:async options=>{ax.push(options);}};
 const captured=await captureScreenshotWithProvenance(tab,cdp,screenshotParams);
 expect(captured.result).toEqual({data:'retry'});
 expect(captured.provenance).toMatchObject({path:'getAXState-retry',directAttempt:{outcome:'error'},axFallback:{used:true,outcome:'success'},retryAttempt:{outcome:'success'}});
 const recorded=JSON.stringify(captured.provenance);
 expect(recorded).not.toContain('private.example.test');
 expect(recorded).not.toContain('also-raw');
 expect(captured.provenance.directAttempt.error.reason.length).toBeLessThanOrEqual(160);
 expect(ax).toEqual([{emit:false}]);
 expect(calls).toEqual([['Page.captureScreenshot',screenshotParams],['Page.captureScreenshot',screenshotParams]]);
});

test('a direct failure without AX support exposes only bounded sanitized provenance',async()=>{
 const cdp={send:async()=>{throw new Error('CDP failed at https://private.example.test/?secret=raw for owner@private.example.test via internal.example.test');}};
 await expect(captureScreenshotWithProvenance({},cdp,screenshotParams)).rejects.toMatchObject({
  captureProvenance:{path:'failed',directAttempt:{outcome:'error'},axFallback:{used:false}},
 });
 try{await captureScreenshotWithProvenance({},cdp,screenshotParams);}catch(error){
  expect(error.message).not.toContain('private.example.test');
  expect(error.message).not.toContain('internal.example.test');
  expect(error.message).not.toContain('owner@');
  expect(error.captureProvenance.directAttempt.error.reason.length).toBeLessThanOrEqual(160);
 }
});

test('a failed retry identifies both attempts and reuses the unchanged screenshot parameters',async()=>{
 const calls=[],errors=[new Error('direct https://one.example.test/?token=raw'),new Error('retry https://two.example.test/?password=raw')];
 const cdp={send:async(method,params)=>{calls.push([method,params]);throw errors.shift();}},tab={getAXState:async()=>{}};
 try{await captureScreenshotWithProvenance(tab,cdp,screenshotParams);throw new Error('expected capture failure');}catch(error){
  expect(error.captureProvenance).toMatchObject({path:'failed',directAttempt:{outcome:'error'},axFallback:{used:true,outcome:'success'},retryAttempt:{outcome:'error'}});
  expect(JSON.stringify(error.captureProvenance)).not.toMatch(/one\.example|two\.example|token=raw|password=raw/);
 }
 expect(calls).toEqual([['Page.captureScreenshot',screenshotParams],['Page.captureScreenshot',screenshotParams]]);
});

test('capture failure still clears device metrics and emulated media',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pagecraft-capture-cleanup-')),calls=[];
 const runtime={userAgent:'Chrome',platform:'MacIntel',userAgentData:{supported:false},devicePixelRatio:1,visualViewportScale:1,screen:{width:1440,height:900,availWidth:1440,availHeight:900,colorDepth:24,pixelDepth:24},colorGamut:{srgb:true,p3:false,rec2020:false},dynamicRange:{standard:true,high:false},colorScheme:{light:true,dark:false}};
 const cdp={send:async(method,params)=>{
  calls.push([method,params]);
  if(method==='Runtime.evaluate')return params.expression.startsWith('JSON.stringify')?{result:{value:JSON.stringify(runtime)}}:{result:{value:'loaded'}};
  if(method==='Page.getLayoutMetrics')return {cssContentSize:{height:900}};
  if(method==='Browser.getVersion'||method==='Browser.getBrowserCommandLine'||method==='SystemInfo.getInfo')throw new Error('unsupported');
  if(method==='Page.captureScreenshot')throw new Error('capture unavailable');
  return {};
 }};
 const tab={
  capabilities:{get:async()=>cdp},
  playwright:{
   evaluate:async(_fn,arg)=>arg?{x:0,y:0,width:100,height:30}:{width:1440,innerHeight:900,scrollHeight:900,scrollWidth:1440,fonts:'loaded'},
   getByRole:()=>({click:async()=>{}}),
   locator:()=>({waitFor:async()=>{},press:async()=>{},click:async()=>{}}),
  },
 };
 try{
  await expect(captureGallery(tab,directory,behaviorChecks)).rejects.toThrow('capture unavailable');
  expect(calls.slice(-2).map(([method])=>method)).toEqual(['Emulation.clearDeviceMetricsOverride','Emulation.setEmulatedMedia']);
  expect(calls.at(-1)[1]).toEqual({features:[]});
 }finally{await rm(directory,{recursive:true,force:true});}
});

const runTimedCapture=async pending=>{
 let settled=false;pending.then(()=>{settled=true;},()=>{settled=true;});
 for(let step=0;!settled&&step<1000;step++){
  await new Promise(resolve=>setImmediate(resolve));
  if(vi.getTimerCount())await vi.runOnlyPendingTimersAsync();
 }
 if(!settled)throw new Error('Timed gallery capture did not settle.');
 return pending;
};

const galleryHarness=png=>{
 const screenshotCalls=[];
 let host='cloud';
 const runtime={userAgent:'Chrome',platform:'MacIntel',userAgentData:{supported:false},devicePixelRatio:1,visualViewportScale:1,screen:{width:1440,height:900,availWidth:1440,availHeight:900,colorDepth:24,pixelDepth:24},colorGamut:{srgb:true,p3:false,rec2020:false},dynamicRange:{standard:true,high:false},colorScheme:{light:true,dark:false}};
 const cdp={send:async(method,params)=>{
  if(method==='Runtime.evaluate')return params.expression.startsWith('JSON.stringify')?{result:{value:JSON.stringify(runtime)}}:{result:{value:'loaded'}};
  if(method==='Page.getLayoutMetrics')return {cssContentSize:{height:900}};
  if(method==='Page.captureScreenshot'){screenshotCalls.push(structuredClone(params));return {data:png.toString('base64')};}
  if(method==='Browser.getVersion'||method==='Browser.getBrowserCommandLine'||method==='SystemInfo.getInfo')throw new Error('unsupported');
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
   locator:()=>({waitFor:async()=>{},press:async()=>{},click:async()=>{}}),
  },
  pressKey:async()=>{},
 };
 return {screenshotCalls,tab};
};

test('default viewport-only and explicit whole-document recipes reach CDP and evidence unchanged',async()=>{
 const defaultDirectory=await mkdtemp(join(tmpdir(),'pagecraft-capture-default-'));
 const explicitDirectory=await mkdtemp(join(tmpdir(),'pagecraft-capture-explicit-'));
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer();
 vi.useFakeTimers({toFake:['setTimeout']});
 try{
  const defaultHarness=galleryHarness(png);
  const defaultResult=await runTimedCapture(captureGallery(defaultHarness.tab,defaultDirectory,behaviorChecks));
  expect(defaultResult.screenshots).toBe(names.length);
  expect(defaultHarness.screenshotCalls).toHaveLength(names.length);
  expect(defaultHarness.screenshotCalls.every(params=>params.captureBeyondViewport===false)).toBe(true);
  expect(defaultHarness.screenshotCalls.every(params=>params.fromSurface===true&&params.optimizeForSpeed===false)).toBe(true);
  const defaultEvidence=JSON.parse(await readFile(join(defaultDirectory,'capture.json'),'utf8'));
  expect(defaultEvidence.captureRecipe.screenshot).toMatchObject({fromSurface:true,captureBeyondViewport:false,optimizeForSpeed:false});
  expect(Object.values(defaultEvidence.captures).every(capture=>capture.captureParameters.screenshot.captureBeyondViewport===false)).toBe(true);

  const explicitHarness=galleryHarness(png);
  const explicitResult=await runTimedCapture(captureGallery(explicitHarness.tab,explicitDirectory,behaviorChecks,{captureBeyondViewport:true}));
  expect(explicitResult.screenshots).toBe(names.length);
  expect(explicitHarness.screenshotCalls).toHaveLength(names.length);
  expect(explicitHarness.screenshotCalls.every(params=>params.captureBeyondViewport===true)).toBe(true);
  expect(explicitHarness.screenshotCalls.every(params=>params.fromSurface===true&&params.optimizeForSpeed===false)).toBe(true);
  const explicitEvidence=JSON.parse(await readFile(join(explicitDirectory,'capture.json'),'utf8'));
  expect(explicitEvidence.captureRecipe.screenshot).toMatchObject({fromSurface:true,captureBeyondViewport:true,optimizeForSpeed:false});
  expect(Object.values(explicitEvidence.captures).every(capture=>capture.captureParameters.screenshot.captureBeyondViewport===true)).toBe(true);
 }finally{
  vi.useRealTimers();
  await Promise.all([rm(defaultDirectory,{recursive:true,force:true}),rm(explicitDirectory,{recursive:true,force:true})]);
 }
});

test('captureGallery rejects a non-boolean captureBeyondViewport option',async()=>{
 await expect(captureGallery({},'unused',behaviorChecks,{captureBeyondViewport:'false'})).rejects.toThrow(TypeError);
});
