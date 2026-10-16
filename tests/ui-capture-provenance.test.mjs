import {test,expect} from 'vitest';
import sharp from 'sharp';
import {captureCodeHashes,names,validateCaptureEvidence} from '../tools/ui-baselines.mjs';
import {pngColorMetadata} from '../tools/png-color-metadata.mjs';

const behaviorChecks=[{host:'cloud',check:'gallery ready',passed:true}];
const captures=Object.fromEntries(names.map(name=>{
 const width=Number(name.match(/-(\d+)\.png$/)[1]),height=900;
 const screenshot={format:'png',fromSurface:true,captureBeyondViewport:true,optimizeForSpeed:false,clip:{x:0,y:0,width,height,scale:1}};
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
 captureRecipe:{metrics:{deviceScaleFactor:1,mobile:false,scale:1},screenshot:{format:'png',fromSurface:true,captureBeyondViewport:true,optimizeForSpeed:false,clipScale:1},settling:{fontsReady:true,animationFrames:2,heightRemeasure:true,maxHeightAttempts:3},provenanceViewport:{width:1440,height:900,deviceScaleFactor:1}},
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
