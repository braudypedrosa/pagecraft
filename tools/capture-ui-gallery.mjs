/** Run inside the Codex built-in-browser JavaScript session with an already selected gallery
 * tab, or through capture-ui-gallery-chrome.mjs, which supplies an equivalent headless Chrome
 * tab. This helper creates no browser process; `browser` records honestly which one it was. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {root,sourceHashes,names} from './ui-gallery-contract.mjs';
import {pngColorMetadata} from './png-color-metadata.mjs';

const sections=['fields','actions','tables','menus','dialogs','feedback'];
const states={fields:'Focused field, readonly, disabled and validation samples',actions:'Processing action, disabled and destructive actions',tables:'First row hovered, second row neutral, empty result',menus:'Open picker, selected/disabled options and menu items',dialogs:'Open dialog with header, body and footer',feedback:'Recoverable inline failure and alert notification'};
const safeSwitches=new Set(['disable-gpu','disable-gpu-compositing','disable-software-rasterizer','enable-features','disable-features','force-color-profile','force-device-scale-factor','headless','ozone-platform','use-angle','use-gl']);
const captureCodeFiles=['tools/capture-ui-gallery.mjs','tools/png-color-metadata.mjs'];
const metricsFor=(width,height)=>({width,height,deviceScaleFactor:1,mobile:false,scale:1});
const screenshotFor=(width,height)=>({format:'png',fromSurface:true,captureBeyondViewport:true,optimizeForSpeed:false,clip:{x:0,y:0,width,height,scale:1}});
const hash=value=>createHash('sha256').update(value).digest('hex');
const captureCodeHashes=async()=>Object.fromEntries(await Promise.all(captureCodeFiles.map(async file=>[file,hash(await readFile(resolve(root,file)))])));

const captureErrorReason=error=>{
 const message=typeof error?.message==='string'?error.message:typeof error==='string'?error:'Capture command failed.';
 return (message
  .replace(/\b(?:https?|wss?):\/\/[^\s"'<>]+/gi,'[url redacted]')
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email redacted]')
  .replace(/\b(?:[A-Z0-9-]+\.)+[A-Z]{2,}(?::\d+)?\b/gi,'[host redacted]')
  .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g,'[ip redacted]')
  .replace(/\b(authorization|cookie|token|secret|password)\s*[:=]\s*[^\s,;]+/gi,'$1=[redacted]')
  .replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,160)||'Capture command failed.');
};
const captureError=error=>({name:typeof error?.name==='string'&&/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(error.name)?error.name:'Error',reason:captureErrorReason(error)});
const failedCapture=(error,provenance)=>{
 const failure=new Error(provenance.retryAttempt?.error?.reason||provenance.axFallback?.error?.reason||provenance.directAttempt.error?.reason||'Gallery screenshot capture failed.');
 failure.name=captureError(error).name;failure.captureProvenance=provenance;return failure;
};

export async function captureScreenshotWithProvenance(tab,cdp,params){
 try{
  const result=await cdp.send('Page.captureScreenshot',params);
  return {result,provenance:{path:'direct',directAttempt:{outcome:'success'},axFallback:{used:false}}};
 }catch(error){
  const directAttempt={outcome:'error',error:captureError(error)};
  if(typeof tab.getAXState!=='function')throw failedCapture(error,{path:'failed',directAttempt,axFallback:{used:false}});
  try{await tab.getAXState({emit:false});}
  catch(axError){throw failedCapture(axError,{path:'failed',directAttempt,axFallback:{used:true,outcome:'error',error:captureError(axError)}});}
  try{
   const result=await cdp.send('Page.captureScreenshot',params);
   return {result,provenance:{path:'getAXState-retry',directAttempt,axFallback:{used:true,outcome:'success'},retryAttempt:{outcome:'success'}}};
  }catch(retryError){
   throw failedCapture(retryError,{path:'failed',directAttempt,axFallback:{used:true,outcome:'success'},retryAttempt:{outcome:'error',error:captureError(retryError)}});
  }
 }
}

function sanitizeSwitches(values=[]){
 return values.filter(value=>typeof value==='string'&&value.startsWith('--')).filter(value=>safeSwitches.has(value.slice(2).split('=',1)[0]));
}
function sanitizeCommandLine(value=''){
 return sanitizeSwitches(String(value).match(/--[^\s"']+/g)||[]);
}
async function optionalProbe(cdp,method,sanitize){
 try{return {supported:true,value:sanitize(await cdp.send(method))};}
 catch{return {supported:false};}
}
const sanitizeSystemInfo=info=>({
 modelName:typeof info.modelName==='string'?info.modelName:'',
 modelVersion:typeof info.modelVersion==='string'?info.modelVersion:'',
 commandLineSwitches:sanitizeCommandLine(info.commandLine),
 gpu:info.gpu?{
  devices:Array.isArray(info.gpu.devices)?info.gpu.devices.map(device=>({vendorId:device.vendorId,deviceId:device.deviceId,subSysId:device.subSysId,revision:device.revision,vendorString:device.vendorString,deviceString:device.deviceString,driverVendor:device.driverVendor,driverVersion:device.driverVersion})):[],
  featureStatus:info.gpu.featureStatus||{},
  driverBugWorkarounds:Array.isArray(info.gpu.driverBugWorkarounds)?info.gpu.driverBugWorkarounds:[],
 }:null,
});

async function settle(cdp){
 const result=await cdp.send('Runtime.evaluate',{
  expression:'(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return document.fonts.status;})()',
  awaitPromise:true,returnByValue:true,
 },{timeoutMs:10000});
 if(result.exceptionDetails||result.result?.value!=='loaded')throw new Error('Gallery paint did not settle after fonts and two animation frames.');
}
async function measure(tab,cdp){
 const [dom,layout]=await Promise.all([
  tab.playwright.evaluate(()=>({width:innerWidth,innerHeight,scrollHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,fonts:document.fonts.status})),
  cdp.send('Page.getLayoutMetrics'),
 ]);
 const contentHeight=layout.cssContentSize?.height??layout.contentSize?.height??0;
 return {width:dom.width,height:Math.ceil(Math.max(dom.innerHeight,dom.scrollHeight,contentHeight)),overflow:dom.scrollWidth>dom.width,fonts:dom.fonts};
}
async function stabilizeHeight(tab,cdp,width){
 let measurement=await measure(tab,cdp);
 for(let attempt=0;attempt<3;attempt++){
  await cdp.send('Emulation.setDeviceMetricsOverride',metricsFor(width,measurement.height));
  await settle(cdp);
  const next=await measure(tab,cdp);
  if(next.height===measurement.height)return next;
  measurement=next;
 }
 throw new Error(`Gallery height did not stabilize at ${width}px.`);
}
async function runtimeCharacteristics(cdp){
 const expression=`JSON.stringify((()=>{let userAgentData={supported:false};try{if(navigator.userAgentData){const value=typeof navigator.userAgentData.toJSON==='function'?navigator.userAgentData.toJSON():{brands:navigator.userAgentData.brands,mobile:navigator.userAgentData.mobile,platform:navigator.userAgentData.platform};userAgentData={supported:true,value};}}catch{}return {userAgent:navigator.userAgent,platform:navigator.platform,userAgentData,devicePixelRatio,visualViewportScale:typeof visualViewport==='undefined'?null:visualViewport.scale,screen:{width:screen.width,height:screen.height,availWidth:screen.availWidth,availHeight:screen.availHeight,colorDepth:screen.colorDepth,pixelDepth:screen.pixelDepth},colorGamut:{srgb:matchMedia('(color-gamut: srgb)').matches,p3:matchMedia('(color-gamut: p3)').matches,rec2020:matchMedia('(color-gamut: rec2020)').matches},dynamicRange:{standard:matchMedia('(dynamic-range: standard)').matches,high:matchMedia('(dynamic-range: high)').matches},colorScheme:{light:matchMedia('(prefers-color-scheme: light)').matches,dark:matchMedia('(prefers-color-scheme: dark)').matches}};})())`;
 const {result,exceptionDetails}=await cdp.send('Runtime.evaluate',{expression,returnByValue:true});
 if(exceptionDetails||typeof result?.value!=='string')throw new Error('Could not read capture environment through CDP Runtime.evaluate.');
 try{return JSON.parse(result.value);}catch{throw new Error('Capture environment returned invalid JSON.');}
}

export async function captureGallery(tab,directory,behaviorChecks,{browser='Codex In-app Browser',browserVersion:declaredBrowserVersion}={}){
 if(!behaviorChecks?.length||behaviorChecks.some(check=>check.passed!==true))throw new Error('Pass the completed behavior-check results before capturing.');
 await mkdir(directory,{recursive:true});const cdp=await tab.capabilities.get('cdp');
 let failed=false;
 try{
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await cdp.send('Emulation.setDeviceMetricsOverride',metricsFor(1440,900));
  await settle(cdp);
  const browserVersion=await optionalProbe(cdp,'Browser.getVersion',result=>Object.fromEntries(['protocolVersion','product','revision','userAgent','jsVersion'].map(field=>[field,result[field]])));
  if(declaredBrowserVersion&&browserVersion.supported&&declaredBrowserVersion!==browserVersion.value.product)throw new Error(`Declared browser version does not match Browser.getVersion (${declaredBrowserVersion} != ${browserVersion.value.product}).`);
  const declaredVersion=declaredBrowserVersion?{value:declaredBrowserVersion,verified:browserVersion.supported}:null;
  const captureEnvironment={
   runtime:await runtimeCharacteristics(cdp),
   browserCommandLine:await optionalProbe(cdp,'Browser.getBrowserCommandLine',result=>({switches:sanitizeSwitches(result.arguments)})),
   systemInfo:await optionalProbe(cdp,'SystemInfo.getInfo',sanitizeSystemInfo),
  };
  const captureRecipe={
   metrics:{deviceScaleFactor:1,mobile:false,scale:1},
   screenshot:{format:'png',fromSurface:true,captureBeyondViewport:true,optimizeForSpeed:false,clipScale:1},
   settling:{fontsReady:true,animationFrames:2,heightRemeasure:true,maxHeightAttempts:3},
   provenanceViewport:{width:1440,height:900,deviceScaleFactor:1},
  };
  const captureCode=await captureCodeHashes();
  const evidence={captureSchemaVersion:2,capturedAt:new Date().toISOString(),browser,browserVersion,...(declaredVersion?{declaredBrowserVersion:declaredVersion}:{}),captureEnvironment,captureRecipe,captureCode,deviceScaleFactor:1,viewportHeight:900,reducedMotion:true,sources:await sourceHashes(),behaviorChecks,captures:{}};
  for(const width of [1440,768])for(const host of ['cloud','builder'])for(const section of sections){
   await cdp.send('Emulation.setDeviceMetricsOverride',metricsFor(width,900));
   if(await tab.playwright.evaluate(()=>document.body.dataset.galleryHost)!==host){
    await tab.playwright.getByRole('link',{name:host==='cloud'?'Cloud':'Builder',exact:true}).click();
    await tab.playwright.locator(`body[data-gallery-host="${host}"]`).waitFor({state:'attached'});
   }
   await tab.playwright.getByRole('link',{name:section[0].toUpperCase()+section.slice(1),exact:true}).click();
   await tab.playwright.locator(`body[data-gallery-host="${host}"][data-gallery-section="${section}"]`).waitFor({state:'attached'});
   await tab.playwright.locator('body').press('Control+Home');
   await tab.playwright.evaluate(async()=>{await document.fonts.ready;return document.documentElement.dataset.galleryReady;});
   if(section==='fields')await tab.playwright.locator(host==='cloud'?'#site-name':'#editor-name').click();
   if(section==='actions')await tab.playwright.getByRole('button',{name:'Start processing',exact:true}).click();
   if(section==='menus')await tab.playwright.getByRole('combobox',{name:'Current page',exact:true}).click();
   if(section==='dialogs')await tab.playwright.getByRole('button',{name:'Open dialog',exact:true}).click();
   if(section==='feedback')await tab.playwright.getByRole('button',{name:'Show error',exact:true}).click();
   const target=section==='tables'?(host==='cloud'?'.pc-sub-table tbody tr':'.pagerow'):section==='dialogs'?'.pc-dialog-head':'.gallery-top strong';
   const rect=await tab.playwright.evaluate(selector=>document.querySelector(selector).getBoundingClientRect().toJSON(),target);
   await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x+Math.min(20,rect.width/2),y:rect.y+Math.min(12,rect.height/2)});
   await new Promise(resolve=>setTimeout(resolve,500));
   const measurement=await stabilizeHeight(tab,cdp,width);
   if(measurement.overflow||measurement.fonts!=='loaded')throw new Error(`Gallery not ready: ${host}/${section}/${width}`);
   const metrics=metricsFor(width,measurement.height),screenshotParams=screenshotFor(width,measurement.height);
   const {result,provenance}=await captureScreenshotWithProvenance(tab,cdp,screenshotParams),bytes=Buffer.from(result.data,'base64');
   const name=`${host}-${section}-${width}.png`;await writeFile(resolve(directory,name),bytes);
   evidence.captures[name]={state:states[section],...measurement,captureParameters:{metricsOverride:metrics,screenshot:screenshotParams},screenshotProvenance:provenance,pngColorMetadata:pngColorMetadata(bytes)};
   if(section==='menus'||section==='dialogs')await tab.pressKey('Escape');
  }
  if(names.some(name=>!evidence.captures[name]))throw new Error('Incomplete capture inventory');
  const current=await sourceHashes();if(Object.keys(current).some(file=>current[file]!==evidence.sources[file]))throw new Error('UI sources changed during capture.');
  const currentCaptureCode=await captureCodeHashes();if(Object.keys(currentCaptureCode).some(file=>currentCaptureCode[file]!==evidence.captureCode[file]))throw new Error('Capture code changed during capture.');
  await writeFile(resolve(directory,'capture.json'),JSON.stringify(evidence,null,2)+'\n');
  return {screenshots:names.length,directory};
 }catch(error){failed=true;throw error;}
 finally{
  const cleanup=await Promise.allSettled([cdp.send('Emulation.clearDeviceMetricsOverride',{}),cdp.send('Emulation.setEmulatedMedia',{features:[]})]);
  if(!failed){const rejected=cleanup.find(result=>result.status==='rejected');if(rejected)throw rejected.reason;}
 }
}
export const readBehaviorChecks=async directory=>JSON.parse(await readFile(resolve(directory,'behavior-checks.json'),'utf8'));
