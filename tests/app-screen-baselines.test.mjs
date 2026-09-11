import {test,expect} from 'vitest';
import {validateCapture} from '../tools/app-screen-baselines.mjs';
const evidence=()=>({browser:'Codex In-app Browser',viewportHeight:900,deviceScaleFactor:1,reducedMotion:true,deployment:'a'.repeat(40),captures:Object.fromEntries([768,1440].map(width=>[`pages-${width}.png`,{name:'pages',state:'Empty search',url:'https://staging.itspagecraft.com/edit/qa',width,height:900,measurement:[{fonts:'loaded',overflow:false}],checks:[{check:'Heading actions',passed:true}]}]))});
test('real-screen review requires both supported desktop and tablet captures',()=>{
 expect(validateCapture(evidence())).toHaveLength(2);
 const missing=evidence();delete missing.captures['pages-768.png'];expect(()=>validateCapture(missing)).toThrow('Missing 768px');
});
test('real-screen review rejects production, overflow, unloaded fonts and failed geometry',()=>{
 for(const patch of [{url:'https://build.itspagecraft.com/edit/qa'},{measurement:[{overflow:true,fonts:'loaded'}]},{measurement:[{overflow:false,fonts:'loading'}]},{checks:[{passed:false}]}]){
  const item=evidence();Object.assign(item.captures['pages-768.png'],patch);expect(()=>validateCapture(item)).toThrow('Incomplete or failed capture');
 }
});
test('an empty inventory or unverified deployment cannot be approved',()=>{
 expect(()=>validateCapture({...evidence(),captures:{}})).toThrow('Empty screen inventory');
 expect(()=>validateCapture({...evidence(),deployment:'development'})).toThrow('capture conditions');
});
