import {test} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source = readFileSync(new URL('../builder.html', import.meta.url),'utf8');
function fixture() {
 const dom = new JSDOM(source, {runScripts:'outside-only'});
 let timeout, cleared = false;
 dom.window.setTimeout = (fn, delay) => {if(delay <= 450) fn(); else timeout=fn; return 1;};
 dom.window.clearTimeout = () => {cleared=true;};
 dom.window.eval(dom.window.document.getElementById('builder-loading-controller').textContent);
 return {dom,document:dom.window.document,api:dom.window.PC_BUILDER_LOADING,slow:()=>timeout(),cleared:()=>cleared};
}
test('startup hides and locks the editor until ready, then releases it',async()=>{
 const f=fixture(); const app=f.document.getElementById('app');
 assert.equal(app.getAttribute('aria-busy'),'true'); assert.ok(app.hasAttribute('inert'));
 assert.equal(f.document.getElementById('builderLoading').hidden,false);
 await f.api.ready(); assert.ok(f.cleared()); assert.equal(app.hasAttribute('inert'),false);
 assert.equal(app.getAttribute('aria-busy'),'false'); assert.equal(f.document.getElementById('builderLoading').hidden,true);
 f.dom.window.close();
});
test('slow startup offers recovery but can still complete',async()=>{
 const f=fixture(); f.slow(); assert.equal(f.document.getElementById('builderLoadingRetry').hidden,false);
 assert.match(f.document.getElementById('builderLoadingStatus').textContent,/keep waiting/);
 await f.api.ready(); assert.equal(f.document.getElementById('builderLoading').hidden,true); f.dom.window.close();
});
test('failed startup keeps partial editor locked and offers recovery',()=>{
 const f=fixture(); f.api.fail(); assert.ok(f.cleared());
 assert.ok(f.document.getElementById('app').hasAttribute('inert'));
 assert.equal(f.document.getElementById('builderLoadingRetry').hidden,false);
 assert.equal(f.document.querySelector('.boot-progress').hidden,true); f.dom.window.close();
});
