/** Run only inside the Codex built-in-browser JavaScript session, with an
 * already selected gallery tab. No browser process or network client is created. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {sourceHashes,names} from './ui-gallery-contract.mjs';
const sections=['fields','actions','tables','menus','dialogs','feedback'];
const states={fields:'Focused field, readonly, disabled and validation samples',actions:'Processing action, disabled and destructive actions',tables:'First row hovered, second row neutral, empty result',menus:'Open picker, selected/disabled options and menu items',dialogs:'Open dialog with header, body and footer',feedback:'Recoverable inline failure and alert notification'};
export async function captureGallery(tab,directory,behaviorChecks){
 if(!behaviorChecks?.length||behaviorChecks.some(check=>check.passed!==true))throw new Error('Pass the completed behavior-check results before capturing.');
 await mkdir(directory,{recursive:true});const cdp=await tab.capabilities.get('cdp');
 const evidence={capturedAt:new Date().toISOString(),browser:'Codex In-app Browser',deviceScaleFactor:1,viewportHeight:900,reducedMotion:true,sources:await sourceHashes(),behaviorChecks,captures:{}};
 await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 try{
 for(const width of [1440,768])for(const host of ['cloud','builder'])for(const section of sections){
   await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false,scale:1});
   if(await tab.playwright.evaluate(()=>document.body.dataset.galleryHost)!==host){
    await tab.playwright.getByRole('link',{name:host==='cloud'?'Cloud':'Builder',exact:true}).click();
    await tab.playwright.locator(`body[data-gallery-host="${host}"]`).waitFor({state:'attached'});
   }
   await tab.playwright.getByRole('link',{name:section[0].toUpperCase()+section.slice(1),exact:true}).click();
   await tab.playwright.locator(`body[data-gallery-host="${host}"][data-gallery-section="${section}"]`).waitFor({state:'attached'});
   await tab.playwright.evaluate(async()=>{scrollTo(0,0);await document.fonts.ready;return document.documentElement.dataset.galleryReady;});
   if(section==='fields')await tab.playwright.locator(host==='cloud'?'#site-name':'#editor-name').click();
   if(section==='actions')await tab.playwright.getByRole('button',{name:'Start processing',exact:true}).click();
   if(section==='menus')await tab.playwright.getByRole('combobox',{name:'Current page',exact:true}).click();
   if(section==='dialogs')await tab.playwright.getByRole('button',{name:'Open dialog',exact:true}).click();
   if(section==='feedback')await tab.playwright.getByRole('button',{name:'Show error',exact:true}).click();
   const target=section==='tables'?(host==='cloud'?'.pc-sub-table tbody tr':'.pagerow'):section==='dialogs'?'.pc-dialog-head':'.gallery-top strong';
   const rect=await tab.playwright.evaluate(selector=>document.querySelector(selector).getBoundingClientRect().toJSON(),target);
   await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x+Math.min(20,rect.width/2),y:rect.y+Math.min(12,rect.height/2)});
   await new Promise(r=>setTimeout(r,500));
   const measurement=await tab.playwright.evaluate(()=>({width:innerWidth,height:Math.max(innerHeight,document.documentElement.scrollHeight),overflow:document.documentElement.scrollWidth>innerWidth,fonts:document.fonts.status}));
   if(measurement.overflow||measurement.fonts!=='loaded')throw new Error(`Gallery not ready: ${host}/${section}/${width}`);
   // The built-in surface captures the painted viewport. Expand long field
   // pages before capture so offscreen content cannot become a blank tail.
   if(measurement.height>900){await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:measurement.height,deviceScaleFactor:1,mobile:false});await new Promise(r=>setTimeout(r,500));}
   // Capture the emulated viewport after expanding it to the full document. Very
   // tall pages are scaled into the built-in surface before requesting their CSS
   // pixel clip; shorter pages avoid offscreen compositor tiles altogether.
   let image;
   if(measurement.height>1200){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:measurement.height,deviceScaleFactor:1,mobile:false,scale:Math.min(1,1000/measurement.height)});
    await new Promise(r=>setTimeout(r,500));
    image=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:measurement.height,scale:1}});
   }else image=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
   const name=`${host}-${section}-${width}.png`;await writeFile(resolve(directory,name),Buffer.from(image.data,'base64'));
   evidence.captures[name]={state:states[section],...measurement};
   if(section==='menus'||section==='dialogs')await tab.pressKey('Escape');
  }
  if(names.some(name=>!evidence.captures[name]))throw new Error('Incomplete capture inventory');
  const current=await sourceHashes();if(Object.keys(current).some(file=>current[file]!==evidence.sources[file]))throw new Error('UI sources changed during capture.');
  await writeFile(resolve(directory,'capture.json'),JSON.stringify(evidence,null,2)+'\n');
  return {screenshots:names.length,directory};
 }finally{await cdp.send('Emulation.clearDeviceMetricsOverride',{});await cdp.send('Emulation.setEmulatedMedia',{features:[]});}
}
export const readBehaviorChecks=async directory=>JSON.parse(await readFile(resolve(directory,'behavior-checks.json'),'utf8'));
