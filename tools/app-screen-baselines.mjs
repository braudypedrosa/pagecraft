/** Private real-screen evidence. Never place account screenshots in public/.
 * Capture with capture-app-screen.mjs, visually review, then record or compare. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {compareImages} from './ui-baselines.mjs';
export function validateCapture(evidence){
 if(evidence.browser!=='Codex In-app Browser'||evidence.viewportHeight!==900||evidence.deviceScaleFactor!==1||evidence.reducedMotion!==true||! /^[a-f0-9]{40}$/.test(evidence.deployment))throw new Error('Missing built-in staging capture conditions.');
 const entries=Object.entries(evidence.captures||{});
 if(!entries.length)throw new Error('Empty screen inventory.');
 for(const [name,item] of entries){
  if(!/^[a-z][a-z0-9-]*-(768|1024|1440)\.png$/.test(name)||new URL(item.url).origin!=='https://staging.itspagecraft.com'||!item.state?.trim()||!item.measurement?.length||item.measurement.some(doc=>doc.overflow||doc.fonts!=='loaded')||item.checks?.some(check=>check.passed!==true))throw new Error(`Incomplete or failed capture: ${name}`);
 }
 const screens=new Set(entries.map(([,item])=>item.name));
 for(const name of screens)for(const width of [768,1440])if(!evidence.captures[`${name}-${width}.png`])throw new Error(`Missing ${width}px companion for ${name}.`);
 return entries;
}
export async function inspectCapture(directory){
 const evidence=JSON.parse(await readFile(resolve(directory,'capture.json'),'utf8'));
 const entries=validateCapture(evidence),images={};
 for(const [name,item] of entries){const bytes=await readFile(resolve(directory,name));const meta=await sharp(bytes).metadata();if(meta.width!==item.width||meta.height!==900||(await sharp(bytes).stats()).entropy<.1)throw new Error(`Invalid or blank screenshot: ${name}`);images[name]=createHash('sha256').update(bytes).digest('hex');}
 return {evidence,images};
}
export async function compareScreens(baseline,candidate){
 const approved=JSON.parse(await readFile(resolve(baseline,'baseline.json'),'utf8'));
 const a=await inspectCapture(baseline),b=await inspectCapture(candidate);
 if(JSON.stringify(approved.images)!==JSON.stringify(a.images))throw new Error('Reviewed baseline images changed.');
 const names=Object.keys(a.images).sort();if(JSON.stringify(names)!==JSON.stringify(Object.keys(b.images).sort()))throw new Error('Screen inventories differ.');
 const results={};for(const name of names){if(a.evidence.captures[name].state!==b.evidence.captures[name].state)throw new Error(`Screen state changed: ${name}`);const {mask,...result}=await compareImages(resolve(baseline,name),resolve(candidate,name));results[name]=result;}
 return results;
}
async function main(){
 const [command,folder,next]=process.argv.slice(2);
 if(command==='record'&&next==='--reviewed'){const {evidence,images}=await inspectCapture(folder);await writeFile(resolve(folder,'baseline.json'),JSON.stringify({reviewedAt:new Date().toISOString(),deployment:evidence.deployment,images},null,2)+'\n');console.log(`Recorded ${Object.keys(images).length} private screen baselines.`);return;}
 if(command==='compare'){const results=await compareScreens(folder,next);await writeFile(resolve(next,'comparison.json'),JSON.stringify(results,null,2)+'\n');const failed=Object.values(results).filter(result=>!result.passed).length;console.log(`${Object.keys(results).length-failed}/${Object.keys(results).length} real screens match. Inspect comparison.json and both screenshots for every difference.`);if(failed)process.exitCode=1;return;}
 throw new Error('Usage: app-screen-baselines.mjs record <captures> --reviewed | compare <baseline> <candidate>');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
