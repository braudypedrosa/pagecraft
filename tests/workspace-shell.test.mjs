import {test, expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {JSDOM} from 'jsdom';
import {UI_FONT_FACES} from '../shared/ui-fonts.js';
import {createApp} from '../server/src/app.ts';
import {MemoryStore} from '../server/src/store.ts';
import {MemoryAuthStore} from '../server/src/auth.ts';
import {siteSubmissionsPage} from '../server/src/account-pages.ts';

test('brand assets resolve from the release when the launcher has a different working directory', () => {
  const module = path => JSON.stringify(new URL(path, import.meta.url).href);
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import {createApp} from ${module('../server/src/app.ts')};
    import {MemoryStore} from ${module('../server/src/store.ts')};
    import {MemoryAuthStore} from ${module('../server/src/auth.ts')};
    const app=createApp({store:new MemoryStore(),auth:new MemoryAuthStore(),editorHost:'admin.test'});
    const assets=['fonts/Manrope-VariableFont_wght.ttf','pagecraft-logo.svg','pagecraft-favicon.svg'];
    console.log(JSON.stringify(await Promise.all(assets.map(async asset=>{
      const r=await app.request('http://admin.test/brand/'+asset,{headers:{host:'admin.test'}});
      return {status:r.status,bytes:(await r.arrayBuffer()).byteLength};
    }))));
  `], {cwd:tmpdir(), encoding:'utf8'});
  const assets=JSON.parse(output);
  expect(assets).toHaveLength(3);
  for (const asset of assets) {
    expect(asset.status).toBe(200);
    expect(asset.bytes).toBeGreaterThan(100);
  }
});

test('Cloud serves the same font bytes as the portable editor, only on the editor host', async () => {
  const app = createApp({store:new MemoryStore(),auth:new MemoryAuthStore(),editorHost:'admin.test'});
  for (const face of UI_FONT_FACES) {
    const response = await app.request(`http://admin.test/brand/fonts/${face.file}`, {headers:{host:'admin.test'}});
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('font/ttf');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(await readFile(`brand/fonts/${face.file}`));
    const published = await app.request(`http://site.test/brand/fonts/${face.file}`, {headers:{host:'site.test'}});
    expect(published.status).not.toBe(200);
  }
  expect((await app.request('http://admin.test/brand/fonts/not-a-product-font.ttf',{headers:{host:'admin.test'}})).status).toBe(404);
});

test('inbox fragments retain the workspace header, scrollable table and accessible dialogs after navigation', () => {
  const user={id:'qa',email:'qa@example.invalid',name:'QA'},site={id:'qa',name:'QA'};
  const forms=[{id:'contact',name:'Contact',pages:['Home'],fields:[]}];
  const entries=[{id:'entry',formId:'contact',formName:'Contact',createdAt:'2026-09-11T00:00:00Z',status:'success',values:[{label:'Name',value:'Workspace QA'}]}];
  const html=siteSubmissionsPage(user,site,'owner',forms,entries,'','',1,true);
  const dom=new JSDOM(html), doc=dom.window.document;
  const host=doc.querySelector('.pc-manage-content');
  expect(doc.querySelector('style#pc-workspace-styles')).not.toBeNull();
  for (const form of ['contact','']) {
    host.innerHTML=siteSubmissionsPage(user,site,'owner',forms,entries,form,'',1,true,undefined,{},true);
    expect(host.querySelector('.pc-workspace-head h1')?.textContent).toBe(form ? 'Contact' : 'Submissions');
    const table=host.querySelector('.pc-sub-table-wrap > table');
    expect(table.querySelectorAll('thead th')).toHaveLength(4);
    expect(table.querySelectorAll('tbody tr')).toHaveLength(1);
    for (const button of host.querySelectorAll('[data-open-dialog]')) {
      const dialog=doc.getElementById(button.getAttribute('data-open-dialog'));
      expect(dialog?.tagName).toBe('DIALOG');
      expect(doc.getElementById(dialog.getAttribute('aria-labelledby'))).not.toBeNull();
    }
  }
  dom.window.close();
});
