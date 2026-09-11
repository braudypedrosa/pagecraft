/** Runs inside Codex's built-in browser session. Navigate through the real UI
 * first; this helper observes and captures that state without submitting data. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {sourceHashes} from './ui-gallery-contract.mjs';

export async function captureAppScreen(tab,directory,{name,state,width=1440,deployment}){
 if(!/^[a-z][a-z0-9-]*$/.test(name)||!state?.trim())throw new Error('Name the screen and describe its visible state.');
 if(![768,1024,1440].includes(width)||! /^[a-f0-9]{40}$/.test(deployment))throw new Error('Provide a supported viewport and the verified staging commit.');
 const url=await tab.playwright.evaluate(()=>location.href);
 if(new URL(url).origin!=='https://staging.itspagecraft.com')throw new Error('Real-screen acceptance captures are staging-only.');
 await mkdir(directory,{recursive:true});
 const path=resolve(directory,'capture.json');let evidence;
 try{evidence=JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 const sources=await sourceHashes();
 if(evidence&&(evidence.deployment!==deployment||JSON.stringify(evidence.sources)!==JSON.stringify(sources)))throw new Error('Commit or sources changed. Start a fresh capture directory.');
 evidence??={version:1,browser:'Codex In-app Browser',deployment,sources,viewportHeight:900,deviceScaleFactor:1,reducedMotion:true,captures:{}};
 const cdp=await tab.capabilities.get('cdp');
 await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
 await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await tab.playwright.evaluate(async()=>{await document.fonts.ready;return true;});
 // Put the pointer in neutral chrome; hovered rows have their own named state.
 await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});
 await new Promise(resolve=>setTimeout(resolve,500));
 // Inspect embedded documents through the frame locator. The browser's
 // read-only DOM scope deliberately does not expose iframe.contentDocument.
 const measure=async element=>{
  const doc=element.ownerDocument;await doc.fonts.ready;
  const visible=element=>{const r=element.getBoundingClientRect();return r.width>0&&r.height>0;};
  const selectors={headingActions:'.pc-workspace-head :is(.btn,.pc-btn),.pc-heading-actions :is(.btn,.pc-btn)',pagination:'.pc-pagination :is(.btn,.pc-btn)',empty:'.pc-list-empty',tableHeads:'.pc-sub-table th,.pc-connections-table thead th',tableCells:'.pc-sub-table td,.pc-connections-table tbody td',fieldGrids:'.pc-field-grid'};
  return {url:doc.URL,viewport:{width:doc.defaultView.innerWidth,height:doc.defaultView.innerHeight},overflow:doc.documentElement.scrollWidth>doc.defaultView.innerWidth,fonts:doc.fonts.status,roles:Object.fromEntries(Object.entries(selectors).map(([role,selector])=>[role,[...doc.querySelectorAll(selector)].filter(visible).map(element=>{const style=doc.defaultView.getComputedStyle(element);return {text:element.textContent.trim().slice(0,100),height:element.getBoundingClientRect().height,x:element.getBoundingClientRect().x,font:style.fontSize,padding:style.padding,textAlign:style.textAlign,columns:style.gridTemplateColumns};})]))};
 };
 const measurement=[await tab.playwright.locator('html').evaluate(measure)];
 if(await tab.playwright.locator('#submissions-workspace').isVisible())measurement.push(await tab.playwright.frameLocator('#submissions-workspace').locator('html').evaluate(measure));
 if(measurement.some(doc=>doc.overflow||doc.fonts!=='loaded'))throw new Error('Screen has horizontal overflow or unloaded fonts.');
 const checks=measurement.flatMap(doc=>[
  ...doc.roles.headingActions.map(control=>({check:`Heading action: ${control.text}`,passed:control.height===37})),
  ...doc.roles.pagination.map(control=>({check:`Pagination: ${control.text}`,passed:control.height===32})),
  ...doc.roles.empty.map(control=>({check:'List empty state',passed:control.font==='12px'&&control.textAlign==='left'}))
 ]);
 if(checks.some(check=>!check.passed))throw new Error(`Shared role mismatch: ${JSON.stringify(checks.filter(check=>!check.passed))}`);
 // This is a viewport capture. Beyond-viewport capture can return an unpainted
 // surface after a Cloud navigation even while the visible screen is correct.
 const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip:{x:0,y:0,width,height:900,scale:1}});
 const bytes=Buffer.from(shot.data,'base64');
 if(bytes.length<24||bytes.toString('hex',0,8)!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)!==width||bytes.readUInt32BE(20)!==900)throw new Error('Incorrectly sized screen capture. Inspect the live screen and recapture.');
 const file=`${name}-${width}.png`;
 await writeFile(resolve(directory,file),bytes);
 evidence.captures[file]={name,state,url,width,height:900,capturedAt:new Date().toISOString(),measurement,checks};
 await writeFile(path,JSON.stringify(evidence,null,2)+'\n');
 return {file,checks:checks.length,validation:'Run node tools/app-screen-baselines.mjs check on this directory before accepting the images.'};
}
export async function restoreAppViewport(tab){const cdp=await tab.capabilities.get('cdp');await cdp.send('Emulation.clearDeviceMetricsOverride',{});await cdp.send('Emulation.setEmulatedMedia',{features:[]});}
