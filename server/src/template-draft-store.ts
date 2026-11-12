import { createHash, randomUUID } from 'node:crypto';
import { mkdir, lstat, readFile, readdir, rm, writeFile, link, realpath, open } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import sharp from 'sharp';
import { MAX_INPUT_PIXELS } from './image-optimization.ts';
import type { Doc } from '../../app/src/core/types.ts';
import { ALLOWED, dimensions, MAX_BYTES, sniff } from './assets.ts';
import { assertSafeStaticSvg } from './releases.ts';
import { validateTemplateDraftDocument } from './template-draft-validation.ts';

export class TemplateDraftError extends Error {
  readonly code: 'invalid'|'not_found'|'conflict'|'exists'|'locked'|'integrity'|'quota';
  constructor(code: TemplateDraftError['code'], message: string) { super(message); this.code=code; }
}
export type DraftAsset = { id:string; name:string; type:string; w:number; h:number; bytes:number; sha256:string };
export type TemplateDraft = { id:string; version:string; name:string; revision:number; document:Doc; assets:DraftAsset[]; createdAt:string; updatedAt:string; actor:string };
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const versionPattern = /^\d+\.\d+\.\d+$/;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const bad = (message:string): never => { throw new TemplateDraftError('invalid',message); };

const syncDir = async (dir:string) => { const file=await open(dir,'r'); try { await file.sync(); } finally { await file.close(); } };
const durableFile = async (path:string, data:string|Uint8Array) => { const file=await open(path,'wx',0o600); try { await file.writeFile(data); await file.sync(); } finally { await file.close(); } };

export class TemplateDraftStore {
  root: string;
  private readonly environment: string;
  private ready = false;
  private readonly maxDraftBytes: number;
  constructor(options: {root:string; environment:string; maxDraftBytes?:number}) {
    if (!isAbsolute(options.root) || !['staging','production','test'].includes(options.environment)) bad('absolute root and valid environment required');
    this.root = resolve(options.root, options.environment);
    this.environment = options.environment;
    this.maxDraftBytes = options.maxDraftBytes ?? 512 * 1024 * 1024;
    if (!Number.isSafeInteger(this.maxDraftBytes) || this.maxDraftBytes < 1) bad('invalid draft storage budget');
  }
  async init() {
    await mkdir(this.root,{recursive:true,mode:0o700});
    const rootStat = await lstat(this.root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) bad('unsafe environment directory');
    this.root = await realpath(this.root);
    const sentinel = join(this.root,'.environment');
    try { await writeFile(sentinel, this.environment, {flag:'wx',mode:0o600}); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
    const marker = await lstat(sentinel);
    if (!marker.isFile() || marker.isSymbolicLink()) bad('unsafe environment marker');
    if ((await readFile(sentinel,'utf8')) !== this.environment) throw new TemplateDraftError('integrity','environment mismatch');
    this.ready = true;
  }
  private dir(id:string, version:string) {
    if (!this.ready) bad('store not initialized');
    if (!idPattern.test(id) || id.length > 80 || !versionPattern.test(version) || version.length > 32) bad('invalid draft identity');
    return join(this.root,id,version);
  }
  private async safeDir(dir:string, create=false) {
    const parts = dir.slice(this.root.length+1).split('/'); let p = this.root;
    for (const part of parts) { p=join(p,part); if (create) await mkdir(p,{mode:0o700}).catch(e => {if(e.code!=='EEXIST') throw e;}); const s=await lstat(p).catch(() => null); if (!s) throw new TemplateDraftError('not_found','draft not found'); if (!s.isDirectory() || s.isSymbolicLink()) bad('unsafe directory'); }
  }
  private async lock<T>(dir:string, fn:()=>Promise<T>):Promise<T> {
    const lock=join(dir,'.lock');
    for (let n=0;n<500;n++) {
      const temp=join(dir,`.lock-${randomUUID()}`);
      await writeFile(temp,JSON.stringify({pid:process.pid}),{flag:'wx',mode:0o600});
      let acquired=false;
      try { await link(temp,lock); acquired=true; }
      catch(e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
      finally { await rm(temp,{force:true}); }
      if (acquired) { try { return await fn(); } finally { await rm(lock,{force:true}); } }
      const info=await readFile(lock,'utf8').then(JSON.parse).catch(()=>null);
      if (Number.isInteger(info?.pid) && info.pid > 0) {
        let dead=false; try { process.kill(info.pid,0); } catch(err) { dead=(err as NodeJS.ErrnoException).code==='ESRCH'; }
        if (dead) {
          const recovery=join(dir,'.recovery');
          try { await mkdir(recovery,{mode:0o700}); try {
            const again=await readFile(lock,'utf8').then(JSON.parse).catch(()=>null);
            if (again?.pid===info.pid) await rm(lock,{force:true});
          } finally { await rm(recovery,{recursive:true,force:true}); } }
          catch(err) { if ((err as NodeJS.ErrnoException).code!=='EEXIST') throw err; }
        }
      }
      await new Promise(resolve => setTimeout(resolve,10));
    }
    throw new TemplateDraftError('locked','draft lock unavailable');
  }
  private async latest(dir:string) {
    const names=await readdir(dir); const revs=names.filter(x=>/^revision-[1-9]\d*\.json$/.test(x)).map(x=>Number(x.slice(9,-5))).sort((a,b)=>b-a);
    return revs[0] || 0;
  }
  private async readAt(dir:string, revision:number):Promise<TemplateDraft> {
    if (revision === 0) throw new TemplateDraftError('not_found','draft not found');
    if (!Number.isSafeInteger(revision) || revision<1) bad('invalid revision');
    const path=join(dir,`revision-${revision}.json`); const stat=await lstat(path).catch(()=>null); if (!stat) throw new TemplateDraftError('not_found','revision not found'); if (!stat.isFile() || stat.isSymbolicLink()) bad('unsafe revision');
    return JSON.parse(await readFile(path,'utf8')) as TemplateDraft;
  }
  private async checkBudget(dir:string, row:TemplateDraft, extraBytes=0) {
    let used = 0;
    for (const name of await readdir(dir)) {
      if (/^\.[a-f0-9-]{36}\.tmp$/.test(name)) { await rm(join(dir,name),{force:true}); continue; }
      if (/^revision-[1-9]\d*\.json$/.test(name)) {
        const entry = await lstat(join(dir,name));
        if (!entry.isFile() || entry.isSymbolicLink()) throw new TemplateDraftError('integrity','unsafe revision');
        used += entry.size;
      }
    }
    const assetsDir=join(dir,'assets');
    const assetDirStat=await lstat(assetsDir).catch(()=>null);
    if (assetDirStat) {
      if (!assetDirStat.isDirectory() || assetDirStat.isSymbolicLink()) throw new TemplateDraftError('integrity','unsafe asset directory');
      for (const name of await readdir(assetsDir)) {
        if (/^\.[a-f0-9-]{36}\.tmp$/.test(name)) { await rm(join(assetsDir,name),{force:true}); continue; }
        if (/^[a-f0-9]{64}$/.test(name)) {
          const entry=await lstat(join(assetsDir,name));
          if (!entry.isFile() || entry.isSymbolicLink()) throw new TemplateDraftError('integrity','unsafe asset');
          used += entry.size;
        }
      }
    }
    if (used + Buffer.byteLength(JSON.stringify(row)) + extraBytes > this.maxDraftBytes) throw new TemplateDraftError('quota','draft storage budget exceeded');
  }
  private async commit(dir:string, row:TemplateDraft) {
    const tmp=join(dir,`.${randomUUID()}.tmp`), dest=join(dir,`revision-${row.revision}.json`);
    await durableFile(tmp,JSON.stringify(row)); try { await link(tmp,dest); await syncDir(dir); } finally { await rm(tmp,{force:true}); }
  }
  async list():Promise<TemplateDraft[]> { if(!this.ready) bad('store not initialized'); const rows:TemplateDraft[]=[]; for(const id of await readdir(this.root)) { if(!idPattern.test(id)) continue; const d=join(this.root,id); if (!(await lstat(d)).isDirectory()) continue; for(const version of await readdir(d)) { if(versionPattern.test(version)) { try { rows.push(await this.read(id,version)); } catch(e) { if (!(e instanceof TemplateDraftError && e.code==='not_found')) throw e; } } } } return rows; }
  async create(input:{id:string;version:string;name:string;document:unknown}, actor:string):Promise<TemplateDraft> {
    const dir=this.dir(input.id,input.version); if (!input.name?.trim() || !actor?.trim()) bad('name and actor required'); await this.safeDir(dir,true);
    return this.lock(dir,async()=>{ if(await this.latest(dir)) throw new TemplateDraftError('exists','draft exists'); const now=new Date().toISOString(); const document=validateTemplateDraftDocument(input.document); const row={id:input.id,version:input.version,name:input.name,revision:1,document,assets:[],createdAt:now,updatedAt:now,actor}; await this.checkBudget(dir,row); await this.commit(dir,row); return row; });
  }
  async read(id:string,version:string,revision?:number):Promise<TemplateDraft> { const dir=this.dir(id,version); await this.safeDir(dir); return this.readAt(dir,revision ?? await this.latest(dir)); }
  async save(id:string,version:string,expectedRevision:number,document:unknown,actor:string):Promise<TemplateDraft> { const dir=this.dir(id,version); await this.safeDir(dir); if(!actor?.trim()) bad('actor required'); return this.lock(dir,async()=>{const current=await this.readAt(dir,await this.latest(dir)); if(current.revision!==expectedRevision) throw new TemplateDraftError('conflict','stale revision'); const next={...current,revision:current.revision+1,document:validateTemplateDraftDocument(document,current.assets.map(a=>a.id)),updatedAt:new Date().toISOString(),actor}; await this.checkBudget(dir,next); await this.commit(dir,next); return next;}); }
  async putAsset(id:string,version:string,expectedRevision:number,input:{name:string;type:string;bytes:Uint8Array;w?:number;h?:number},actor:string):Promise<TemplateDraft> {
    const dir=this.dir(id,version); await this.safeDir(dir); if(!actor?.trim() || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/.test(input.name) || !(input.bytes instanceof Uint8Array) || !input.bytes.length || input.bytes.length>MAX_BYTES) bad('invalid image');
    const detected=sniff(input.bytes); if(!detected || !ALLOWED.has(detected) || detected!==input.type) bad('invalid image type'); const type = detected as string; const digest=hash(input.bytes); assertSafeStaticSvg({id:digest,type,bytes:input.bytes}); const metadata = type === 'image/svg+xml' ? null : await sharp(input.bytes,{animated:true,limitInputPixels:MAX_INPUT_PIXELS}).metadata().catch(()=>bad('invalid image')); const size=metadata ? {w:metadata.width || 0,h:metadata.pageHeight || metadata.height || 0} : dimensions(input.bytes,type); if(!size.w || !size.h) bad('image dimensions unavailable');
    return this.lock(dir,async()=>{const current=await this.readAt(dir,await this.latest(dir)); if(current.revision!==expectedRevision) throw new TemplateDraftError('conflict','stale revision'); const aid=`img-${digest}`; const assetsDir=join(dir,'assets'); await this.safeDir(assetsDir,true); const path=join(assetsDir,digest); const existing=await lstat(path).catch(()=>null); const asset={id:aid,name:input.name,type,w:size.w,h:size.h,bytes:input.bytes.length,sha256:digest}; const next={...current,revision:current.revision+1,assets:[...current.assets.filter(a=>a.id!==aid),asset],updatedAt:new Date().toISOString(),actor}; await this.checkBudget(dir,next,existing ? 0 : input.bytes.length); const temporary=join(assetsDir,`.${randomUUID()}.tmp`); await durableFile(temporary,input.bytes); try { try { await link(temporary,path); await syncDir(assetsDir); } catch(e) { if((e as NodeJS.ErrnoException).code!=='EEXIST') throw e; const st=await lstat(path); if(!st.isFile() || st.isSymbolicLink() || hash(await readFile(path))!==digest) throw new TemplateDraftError('integrity','asset mismatch'); } } finally { await rm(temporary,{force:true}); } await this.commit(dir,next); return next;});
  }
  async assets(id:string,version:string,revision?:number) { return (await this.read(id,version,revision)).assets; }
  async asset(id:string,version:string,assetId:string,revision?:number) { const row=await this.read(id,version,revision); const item=row.assets.find(a=>a.id===assetId); if(!item) throw new TemplateDraftError('not_found','asset not found'); const dir=this.dir(id,version); await this.safeDir(join(dir,'assets')); const path=join(dir,'assets',item.sha256); const st=await lstat(path); if(!st.isFile() || st.isSymbolicLink()) bad('unsafe asset'); const bytes=new Uint8Array(await readFile(path)); if(hash(bytes)!==item.sha256) throw new TemplateDraftError('integrity','asset mismatch'); return {...item,bytes}; }
}
