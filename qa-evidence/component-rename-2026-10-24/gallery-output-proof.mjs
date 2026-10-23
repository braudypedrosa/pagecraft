import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { componentGalleryPage, GALLERY_SECTIONS } from '../../server/src/component-gallery.ts';
const base='6a4207870262a5a33322228f8030b992cf8ea3f4';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const current=await readFile('index.html','utf8');
const prior=execFileSync('git',['show',`${base}:index.html`],{maxBuffer:30*1024*1024}).toString();
for(const file of ['server/src/component-gallery.ts','server/src/account-pages.ts','shared/ui-fonts.js','shared/custom-select.js','shared/action-feedback.js','shared/ui-motion.js']){
 assert.equal(sha(await readFile(file)),sha(execFileSync('git',['show',`${base}:${file}`],{maxBuffer:30*1024*1024})),`${file} exact base`);
}
const outputs=[];
for(const host of ['cloud','builder'])for(const section of GALLERY_SECTIONS){
 const actual=componentGalleryPage(current,host,section), expected=componentGalleryPage(prior,host,section);
 assert.equal(actual,expected,`${host}/${section} full HTML byte equality`);
 outputs.push({host,section,bytes:Buffer.byteLength(actual),candidateSha256:sha(actual),baseSha256:sha(expected),byteExact:true});
}
const health=await fetch('http://127.0.0.1:4953/__gallery-health').then(r=>r.json());
assert.equal(health.root,process.cwd());
const response=await fetch('http://127.0.0.1:4953/internal/components?host=builder&section=fields');
assert.equal(response.status,200);
assert.equal(await response.text(),componentGalleryPage(current,'builder','fields'));
const receipt={base,candidateRoot:process.cwd(),candidateIndexSha256:sha(current),baseIndexSha256:sha(prior),method:'Actual candidate componentGalleryPage with exact committed base index and candidate sealed index; gallery module and direct dependencies exact base.',outputs,fixture:{url:'http://127.0.0.1:4953/internal/components',health,httpMatchesActualFunction:true},baselineWrites:false};
await writeFile('qa-evidence/component-rename-2026-10-24/gallery-output-proof.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({outputs:outputs.length,allByteExact:true,health,httpMatchesActualFunction:true}));
