import {test, expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {JSDOM} from 'jsdom';
import {UI_FONT_FACES} from '../shared/ui-fonts.js';
import {UI_TYPOGRAPHY_CSS} from '../shared/ui-typography.js';
import {UI_FOCUS_CSS} from '../shared/ui-focus.js';
import {createApp} from '../server/src/app.ts';
import {MemoryStore} from '../server/src/store.ts';
import {MemoryAuthStore} from '../server/src/auth.ts';
import {siteSubmissionsPage, siteSettingsPage} from '../server/src/account-pages.ts';

test('editor and Cloud share typography and focus without copying app rules into the canvas font slot', async () => {
  const editor = new JSDOM(await readFile('index.html', 'utf8'));
  const user = {id:'qa',email:'qa@example.invalid',name:'QA'};
  const cloud = new JSDOM(siteSettingsPage(user, {id:'qa',name:'QA',slug:'qa',role:'owner'}));
  const fonts = editor.window.document.querySelector('#pc-fonts').textContent;
  expect(fonts).toContain('@font-face');
  expect(fonts).not.toContain('--pc-');
  expect(fonts).not.toContain('.dashboard-app');
  expect(fonts).not.toContain(':focus');
  expect(editor.window.document.querySelector('#pc-ui-styles').textContent).toContain(UI_TYPOGRAPHY_CSS);
  expect(editor.window.document.querySelector('#pc-ui-styles').textContent).toContain(UI_FOCUS_CSS);
  expect(cloud.window.document.querySelector('#pc-ui-typography').textContent).toBe(UI_TYPOGRAPHY_CSS);
  expect(cloud.window.document.querySelector('#pc-ui-focus').textContent).toBe(UI_FOCUS_CSS);
  expect(editor.window.document.querySelector('#modebar').classList.contains('pc-toolbar-context')).toBe(true);
  editor.window.close();cloud.window.close();
});

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


test('site rename success and validation errors have distinct semantic notices', () => {
  const user={id:'qa',email:'qa@example.invalid',name:'QA'};
  const site={id:'qa',name:'QA',slug:'qa',url:'https://example.test/qa/',role:'owner'};
  const success=new JSDOM(siteSettingsPage(user,site,{message:'Site name updated.'}));
  const failure=new JSDOM(siteSettingsPage(user,site,{error:'invalid'}));
  const ok=success.window.document.querySelector('.notice');
  const bad=failure.window.document.querySelector('.notice');
  expect(ok.getAttribute('role')).toBe('status');expect(bad.getAttribute('role')).toBe('alert');
  expect(success.window.getComputedStyle(ok).backgroundColor).not.toBe(failure.window.getComputedStyle(bad).backgroundColor);
  expect(success.window.getComputedStyle(ok).color).not.toBe(failure.window.getComputedStyle(bad).color);
  success.window.close();failure.window.close();
});

test('Cloud dialog variants share named regions and retain safe deletion controls', async () => {
  const {dashboardPage,siteIntegrationsPage}=await import('../server/src/account-pages.ts');
  const user={id:'qa',email:'qa@example.invalid',name:'QA'};
  const site={id:'qa',name:'QA',slug:'qa',url:'https://example.test/qa/',updatedAt:'2026-09-11T00:00:00Z',role:'owner',published:false};
  const pages=[
    dashboardPage(user,[site],1,{used:0,limit:104857600}),
    siteIntegrationsPage(user,{...site,version:1},{enabled:true,connected:false,selected:[]}),
    siteSubmissionsPage(user,site,'owner',[{id:'contact',name:'Contact',pages:['Home'],fields:[]}],
      [{id:'entry',formId:'contact',formName:'Contact',createdAt:'2026-09-11T00:00:00Z',status:'success',values:[{label:'Name',value:'QA'}]}],'contact','',1,true)
  ];
  let count=0;
  for(const html of pages){
    const dom=new JSDOM(html),d=dom.window.document;
    for(const dialog of d.querySelectorAll('dialog')){
      count++;
      expect(dialog.classList.contains('pc-dialog')).toBe(true);
      const head=dialog.querySelector('.pc-dialog-head');
      expect(head.querySelector('.pc-dialog-title').id).toBe(dialog.getAttribute('aria-labelledby'));
      expect(head.querySelector('.pc-dialog-close').getAttribute('aria-label')).toMatch(/^Close/);
      expect(head.querySelector('.pc-dialog-close svg')).not.toBeNull();
      expect(dialog.querySelector('.pc-dialog-body')).not.toBeNull();
      for(const footer of dialog.querySelectorAll('footer,.pc-delete-dialog-actions,.pc-integration-footer'))
        expect(footer.classList.contains('pc-dialog-foot')).toBe(true);
    }
    if(d.querySelector('#delete-site-dialog')){
      expect(d.querySelectorAll('#delete-site-dialog form')).toHaveLength(1);
      expect(d.querySelector('#dashboard-delete-confirm').required).toBe(true);
      expect(d.querySelector('#confirm-site-delete').disabled).toBe(true);
      expect(d.querySelectorAll('[data-delete-cancel]')).toHaveLength(2);
    }
    dom.window.close();
  }
  expect(count).toBe(5);
});
