/** Built-in-browser capture stays a reviewed step. This tool validates the
 * source contract and compares supplied PNGs; it never launches a browser. */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {root,directory,names,sources,sourceHashes} from './ui-gallery-contract.mjs';
import {pngColorMetadata} from './png-color-metadata.mjs';
export {sourceHashes,names} from './ui-gallery-contract.mjs';
export {pngColorMetadata} from './png-color-metadata.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
/* Each capture path names itself. Adding one here is a review-policy decision, not a fix. */
export const CAPTURE_BROWSERS=['Codex In-app Browser','Headless Chrome'];
const CAPTURE_SCHEMA_VERSION=2;
const captureCodeFiles=['tools/capture-ui-gallery.mjs','tools/png-color-metadata.mjs'];
const requiredVersionFields=['protocolVersion','product','revision','userAgent','jsVersion'];
export const captureCodeHashes=async()=>Object.fromEntries(await Promise.all(captureCodeFiles.map(async file=>[file,hash(await readFile(resolve(root,file)))])));

const isBoolean=value=>typeof value==='boolean';
const isNumber=value=>Number.isFinite(value);
function assertNewCaptureProvenance(evidence){
  if(evidence.captureSchemaVersion!==CAPTURE_SCHEMA_VERSION)throw new Error(`Unsupported capture schema: ${evidence.captureSchemaVersion}`);
  if(!isBoolean(evidence.browserVersion?.supported))throw new Error('Capture schema 2 must record Browser.getVersion support.');
  if(evidence.browserVersion.supported&&requiredVersionFields.some(field=>typeof evidence.browserVersion.value?.[field]!=='string'||!evidence.browserVersion.value[field]))throw new Error('Capture schema 2 requires complete Browser.getVersion provenance when supported.');
  if(evidence.declaredBrowserVersion&&(!isBoolean(evidence.declaredBrowserVersion.verified)||typeof evidence.declaredBrowserVersion.value!=='string'||!evidence.declaredBrowserVersion.value))throw new Error('Capture schema 2 declared browser version provenance is invalid.');
  if(evidence.declaredBrowserVersion?.verified!==undefined&&evidence.declaredBrowserVersion.verified!==evidence.browserVersion.supported)throw new Error('Capture schema 2 declared browser version verification is inconsistent.');
  if(captureCodeFiles.some(file=>!new RegExp('^[a-f0-9]{64}$').test(evidence.captureCode?.[file]||'')))throw new Error('Capture schema 2 requires capture-code hashes.');
  const runtime=evidence.captureEnvironment?.runtime;
  if(!runtime||typeof runtime.userAgent!=='string'||typeof runtime.platform!=='string'||!isBoolean(runtime.userAgentData?.supported)||!isNumber(runtime.devicePixelRatio)||!isNumber(runtime.visualViewportScale)||!isNumber(runtime.screen?.colorDepth)||!isNumber(runtime.screen?.pixelDepth)||['srgb','p3','rec2020'].some(name=>!isBoolean(runtime.colorGamut?.[name]))||['standard','high'].some(name=>!isBoolean(runtime.dynamicRange?.[name])))throw new Error('Capture schema 2 requires runtime and color characteristics.');
  if(!isBoolean(evidence.captureEnvironment?.browserCommandLine?.supported)||!isBoolean(evidence.captureEnvironment?.systemInfo?.supported))throw new Error('Capture schema 2 must record optional probe support.');
  if(evidence.captureEnvironment.browserCommandLine.supported&&!Array.isArray(evidence.captureEnvironment.browserCommandLine.value?.switches))throw new Error('Capture schema 2 requires sanitized browser switches when the probe is supported.');
  if(evidence.captureEnvironment.systemInfo.supported&&!evidence.captureEnvironment.systemInfo.value)throw new Error('Capture schema 2 requires sanitized system information when the probe is supported.');
  const metrics=evidence.captureRecipe?.metrics,screenshot=evidence.captureRecipe?.screenshot,settling=evidence.captureRecipe?.settling,provenanceViewport=evidence.captureRecipe?.provenanceViewport;
  if(metrics?.deviceScaleFactor!==1||metrics?.mobile!==false||metrics?.scale!==1||screenshot?.format!=='png'||screenshot?.fromSurface!==true||screenshot?.captureBeyondViewport!==false||screenshot?.optimizeForSpeed!==false||screenshot?.clipScale!==1||settling?.fontsReady!==true||settling?.animationFrames!==2||settling?.heightRemeasure!==true||provenanceViewport?.width!==1440||provenanceViewport?.height!==900||provenanceViewport?.deviceScaleFactor!==1)throw new Error('Capture schema 2 requires the stable gallery capture recipe.');
  const colorSignatures=new Set();
  for(const name of names){
    const capture=evidence.captures?.[name],params=capture?.captureParameters;
    if(!capture||!params||!capture.pngColorMetadata?.signature)throw new Error(`Capture schema 2 provenance is incomplete for ${name}.`);
    colorSignatures.add(capture.pngColorMetadata.signature);
    const width=Number(name.match(/-(\d+)\.png$/)[1]),height=capture.height;
    if(!Number.isInteger(height)||height<900||params.metricsOverride?.width!==width||params.metricsOverride?.height!==height||params.metricsOverride?.deviceScaleFactor!==1||params.metricsOverride?.mobile!==false||params.metricsOverride?.scale!==1||params.screenshot?.format!=='png'||params.screenshot?.fromSurface!==true||params.screenshot?.captureBeyondViewport!==false||params.screenshot?.optimizeForSpeed!==false||params.screenshot?.clip?.width!==width||params.screenshot?.clip?.height!==height||params.screenshot?.clip?.scale!==1)throw new Error(`Capture schema 2 parameters are inconsistent for ${name}.`);
  }
  if(colorSignatures.size!==1)throw new Error('Capture schema 2 requires one consistent PNG color-metadata signature across the gallery.');
}
export function validateCaptureEvidence(evidence){
  if(!CAPTURE_BROWSERS.includes(evidence.browser)||evidence.deviceScaleFactor!==1||evidence.viewportHeight!==900||evidence.reducedMotion!==true)throw new Error(`Capture metadata must identify an accepted browser (${CAPTURE_BROWSERS.join(', ')}), 1x scale, 900px viewport height and reduced motion.`);
  if(!evidence.behaviorChecks?.length||evidence.behaviorChecks.some(check=>check.passed!==true)||names.some(name=>!evidence.captures?.[name]))throw new Error('Incomplete capture/interaction evidence.');
  if(evidence.captureSchemaVersion!==undefined)assertNewCaptureProvenance(evidence);
  return evidence;
}
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
    const evidence=validateCaptureEvidence(JSON.parse(await readFile(resolve(folder,'capture.json'),'utf8')));
    const current=await sourceHashes();if(sources.some(file=>evidence.sources?.[file]!==current[file]))throw new Error('Source changed after the capture started. Recapture affected states before recording.');
    if(evidence.captureSchemaVersion===CAPTURE_SCHEMA_VERSION){const currentCaptureCode=await captureCodeHashes();if(captureCodeFiles.some(file=>evidence.captureCode[file]!==currentCaptureCode[file]))throw new Error('Capture code changed after the capture started. Recapture before recording.');}
    const images={};for(const name of names){const path=resolve(folder,name),bytes=await readFile(path),meta=await sharp(bytes).metadata();const width=Number(name.match(/-(\d+)\.png$/)[1]);if((await sharp(bytes).stats()).entropy<.1)throw new Error(`Blank capture: ${name}`);if(meta.width!==width||meta.height<900||meta.format!=='png')throw new Error(`Wrong viewport or image format: ${name}`);const color=pngColorMetadata(bytes);if(evidence.captureSchemaVersion===CAPTURE_SCHEMA_VERSION&&color.signature!==evidence.captures[name].pngColorMetadata.signature)throw new Error(`PNG color metadata changed after capture: ${name}`);images[name]={sha256:hash(bytes),width:meta.width,height:meta.height,state:evidence.captures[name].state,...(evidence.captureSchemaVersion===CAPTURE_SCHEMA_VERSION?{captureParameters:evidence.captures[name].captureParameters,pngColorMetadata:color}:{})};}
    await mkdir(directory,{recursive:true});for(const name of names)await copyFile(resolve(folder,name),resolve(directory,name));
    const provenance=evidence.captureSchemaVersion===CAPTURE_SCHEMA_VERSION?{captureSchemaVersion:CAPTURE_SCHEMA_VERSION,browserVersion:evidence.browserVersion,...(evidence.declaredBrowserVersion?{declaredBrowserVersion:evidence.declaredBrowserVersion}:{}),captureEnvironment:evidence.captureEnvironment,captureRecipe:evidence.captureRecipe,captureCode:evidence.captureCode}:evidence.browserVersion?{browserVersion:evidence.browserVersion}:{};
    await writeFile(resolve(directory,'manifest.json'),JSON.stringify({version:evidence.captureSchemaVersion===CAPTURE_SCHEMA_VERSION?2:1,capturedAt:evidence.capturedAt,browser:evidence.browser,...provenance,viewportHeight:900,deviceScaleFactor:1,reducedMotion:true,sources:current,behaviorChecks:evidence.behaviorChecks,images},null,2)+'\n');console.log(`Recorded ${names.length} reviewed baselines.`);return;
  }
  throw new Error('Usage: node tools/ui-baselines.mjs check | compare <captures> | record <captures> --reviewed');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
