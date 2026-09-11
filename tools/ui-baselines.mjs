/** Built-in-browser capture stays a reviewed step. This tool validates the
 * source contract and compares supplied PNGs; it never launches a browser. */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {root,directory,names,sources,sourceHashes} from './ui-gallery-contract.mjs';
export {sourceHashes,names} from './ui-gallery-contract.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
export async function checkBaselines(){
  const manifest=JSON.parse(await readFile(resolve(directory,'manifest.json'),'utf8'));
  const current=await sourceHashes(),changed=sources.filter(file=>current[file]!==manifest.sources[file]);
  if(changed.length)throw new Error(`UI baselines need review after changes to:\n${changed.join('\n')}\nCapture the gallery in the built-in browser, compare, then record the reviewed images. See docs/component-gallery.md.`);
  for(const name of names){
    const image=await readFile(resolve(directory,name));const entry=manifest.images[name];const metadata=await sharp(image).metadata();
    if((await sharp(image).stats()).entropy<.1)throw new Error(`Blank baseline: ${name}`);
    if(!entry||hash(image)!==entry.sha256||metadata.width!==entry.width||metadata.height!==entry.height)throw new Error(`Missing or changed baseline: ${name}`);
  }
  if(Object.keys(manifest.images).length!==names.length)throw new Error('Unexpected baseline inventory');
  return {images:names.length,sourceFiles:sources.length};
}
export async function compareImages(reference,candidate){
  const a=await sharp(reference).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const b=await sharp(candidate).removeAlpha().raw().toBuffer({resolveWithObject:true});
  if(a.info.width!==b.info.width||a.info.height!==b.info.height)return {passed:false,reason:'Image dimensions changed',reference:a.info,candidate:b.info};
  let changed=0;const mask=Buffer.alloc(a.info.width*a.info.height*3);
  for(let i=0;i<a.data.length;i+=3){const delta=Math.max(...[0,1,2].map(c=>Math.abs(a.data[i+c]-b.data[i+c])));const different=delta>20;if(different)changed++;for(let c=0;c<3;c++)mask[i+c]=different?(c===0?220:30):Math.round(a.data[i+c]*.25+191);}
  const ratio=changed/(a.info.width*a.info.height);
  return {passed:ratio<=.001,changedPixels:changed,ratio,width:a.info.width,height:a.info.height,mask};
}
async function main(){
  const [command,folder,approval]=process.argv.slice(2);
  if(command==='check'){console.log('UI baselines verified:',await checkBaselines());return;}
  if(command==='compare'){
    if(!folder)throw new Error('Provide the directory containing new built-in-browser PNG captures.');
    const output=resolve(folder,'diffs');await mkdir(output,{recursive:true});let failures=0;const results={};
    for(const name of names){const {mask,...result}=await compareImages(resolve(directory,name),resolve(folder,name));results[name]=result;if(!result.passed){failures++;if(mask)await sharp(mask,{raw:{width:result.width,height:result.height,channels:3}}).png().toFile(resolve(output,name));}}
    await writeFile(resolve(output,'results.json'),JSON.stringify(results,null,2)+'\n');console.log(`${names.length-failures}/${names.length} screenshots match; differences: ${output}`);if(failures)process.exitCode=1;return;
  }
  if(command==='record'){
    if(!folder||approval!=='--reviewed')throw new Error('Use record <capture-directory> --reviewed only after inspecting all changed screenshots.');
    const evidence=JSON.parse(await readFile(resolve(folder,'capture.json'),'utf8'));
    if(evidence.browser!=='Codex In-app Browser'||evidence.deviceScaleFactor!==1||evidence.viewportHeight!==900||evidence.reducedMotion!==true)throw new Error('Capture metadata must identify the built-in browser, 1x scale, 900px viewport height and reduced motion.');
    if(!evidence.behaviorChecks?.length||evidence.behaviorChecks.some(check=>check.passed!==true)||names.some(name=>!evidence.captures?.[name]))throw new Error('Incomplete capture/interaction evidence.');
    const current=await sourceHashes();if(sources.some(file=>evidence.sources?.[file]!==current[file]))throw new Error('Source changed after the capture started. Recapture affected states before recording.');
    const images={};for(const name of names){const path=resolve(folder,name),bytes=await readFile(path),meta=await sharp(bytes).metadata();const width=Number(name.match(/-(\d+)\.png$/)[1]);if((await sharp(bytes).stats()).entropy<.1)throw new Error(`Blank capture: ${name}`);if(meta.width!==width||meta.height<900||meta.format!=='png')throw new Error(`Wrong viewport or image format: ${name}`);images[name]={sha256:hash(bytes),width:meta.width,height:meta.height,state:evidence.captures[name].state};}
    await mkdir(directory,{recursive:true});for(const name of names)await copyFile(resolve(folder,name),resolve(directory,name));
    await writeFile(resolve(directory,'manifest.json'),JSON.stringify({version:1,capturedAt:evidence.capturedAt,browser:evidence.browser,viewportHeight:900,deviceScaleFactor:1,reducedMotion:true,sources:current,behaviorChecks:evidence.behaviorChecks,images},null,2)+'\n');console.log(`Recorded ${names.length} reviewed baselines.`);return;
  }
  throw new Error('Usage: node tools/ui-baselines.mjs check | compare <captures> | record <captures> --reviewed');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
