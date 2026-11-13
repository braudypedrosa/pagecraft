import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, realpath, writeFile, stat, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { optimizeImage } from '../src/image-optimization.ts';
import { pathToFileURL } from 'node:url';
import { buildTemplateStarter } from '../../premade-sites/lib/authoring.ts';
import { TemplateDraftStore } from '../src/template-draft-store.ts';

describe('template draft store', () => {
  it('preserves immutable revisions and rejects concurrent stale saves', async () => {
    const root=await realpath(await mkdtemp(join(tmpdir(),'template-drafts-')));
    try {
      const a=new TemplateDraftStore({root,environment:'test'}), b=new TemplateDraftStore({root,environment:'test'}); await a.init(); await b.init();
      const doc=buildTemplateStarter('Example');
      await a.create({id:'example',version:'1.0.0',name:'Example',document:doc},'owner');
      const results=await Promise.allSettled([a.save('example','1.0.0',1,doc,'owner'),b.save('example','1.0.0',1,doc,'owner')]);
      expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
      expect((await a.read('example','1.0.0')).revision).toBe(2);
      expect((await a.read('example','1.0.0',1)).revision).toBe(1);
      await expect(a.read('../escape','1.0.0')).rejects.toThrow('invalid draft identity');
    } finally { await rm(root,{recursive:true,force:true}); }
  });
  it('serializes separate processes and recovers a dead owner without committing partial files', async () => {
    const root=await realpath(await mkdtemp(join(tmpdir(),'template-process-')));
    try {
      const store=new TemplateDraftStore({root,environment:'test'}); await store.init();
      const doc=buildTemplateStarter('Example');
      await store.create({id:'example',version:'1.0.0',name:'Example',document:doc},'owner');
      const file=join(root,'document.json'); await writeFile(file,JSON.stringify(doc));
      const module=pathToFileURL(join(process.cwd(),'server/src/template-draft-store.ts')).href;
      const code=`import {readFile} from 'node:fs/promises'; import {TemplateDraftStore} from ${JSON.stringify(module)}; const s=new TemplateDraftStore({root:process.argv[1],environment:'test'}); await s.init(); const doc=JSON.parse(await readFile(process.argv[2])); try {await s.save('example','1.0.0',1,doc,'worker'); process.exit(0)} catch(e) {process.exit(e.code==='conflict'?2:3)}`;
      const run=() => new Promise<number|null>((resolve,reject)=>{ const child=spawn(process.execPath,['--input-type=module','-e',code,root,file],{stdio:'ignore'}); child.on('error',reject); child.on('exit',resolve); });
      expect((await Promise.all([run(),run()])).sort()).toEqual([0,2]);
      const dir=join(root,'test','example','1.0.0');
      const holder=spawn(process.execPath,['--input-type=module','-e',`import {writeFileSync} from 'node:fs'; writeFileSync(process.argv[1],JSON.stringify({pid:process.pid})); process.stdout.write('ready'); setInterval(()=>{},1000);`,join(dir,'.lock')],{stdio:['ignore','pipe','ignore']});
      await new Promise<void>((resolve,reject)=>{ holder.stdout!.once('data',()=>resolve()); holder.once('error',reject); });
      const stopped=new Promise<void>(resolve=>holder.once('exit',()=>resolve())); holder.kill('SIGKILL'); await stopped;
      const orphan=join(dir,'.12345678-1234-1234-1234-123456789abc.tmp');
      await writeFile(orphan,'{');
      expect((await store.read('example','1.0.0')).revision).toBe(2);
      expect((await store.save('example','1.0.0',2,doc,'owner')).revision).toBe(3);
      await expect(access(orphan)).rejects.toMatchObject({code:'ENOENT'});
      expect((await store.read('example','1.0.0',2)).revision).toBe(2);
    } finally { await rm(root,{recursive:true,force:true}); }
  });
  it('accepts optimized JPEG as WebP and derives actual dimensions', async () => {
    const root=await realpath(await mkdtemp(join(tmpdir(),'template-image-')));
    try {
      const store=new TemplateDraftStore({root,environment:'test'}); await store.init();
      await store.create({id:'example',version:'1.0.0',name:'Example',document:buildTemplateStarter('Example')},'owner');
      const jpeg=await sharp({create:{width:24,height:12,channels:3,background:'#336699'}}).jpeg().toBuffer();
      const image=await optimizeImage(jpeg,'image/jpeg');
      const saved=await store.putAsset('example','1.0.0',1,{name:'example.webp',type:image.type,bytes:image.bytes,w:999,h:999},'owner');
      expect(saved.assets[0]).toMatchObject({type:'image/webp',w:24,h:12});
      expect((await store.asset('example','1.0.0',saved.assets[0].id)).bytes).toEqual(image.bytes);
    } finally { await rm(root,{recursive:true,force:true}); }
  });
  it('enforces a per-draft budget without advancing the revision', async () => {
    const root=await realpath(await mkdtemp(join(tmpdir(),'template-budget-')));
    try {
      const initial=new TemplateDraftStore({root,environment:'test'}); await initial.init();
      const doc=buildTemplateStarter('Example');
      await initial.create({id:'example',version:'1.0.0',name:'Example',document:doc},'owner');
      const bytes=(await stat(join(root,'test','example','1.0.0','revision-1.json'))).size;
      const limited=new TemplateDraftStore({root,environment:'test',maxDraftBytes:bytes+100}); await limited.init();
      await expect(limited.save('example','1.0.0',1,doc,'owner')).rejects.toMatchObject({code:'quota'});
      expect((await limited.read('example','1.0.0')).revision).toBe(1);
    } finally { await rm(root,{recursive:true,force:true}); }
  });
});
