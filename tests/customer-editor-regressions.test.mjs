import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const source = readFileSync('builder.html', 'utf8');
const windows = [];
afterEach(() => windows.splice(0).forEach(dom => dom.window.close()));
function browser() {
  const dom = new JSDOM('<div id="editable" tabindex="0">Selected words</div><input id="dialog-url">', {url:'https://example.test/edit/site-one',runScripts:'outside-only'});
  windows.push(dom); return dom.window;
}
test('rich text link dialog keeps editing alive, restores selection and persists keyboard links', async () => {
  const w = browser(), host = w.document.querySelector('#editable');
  const range = w.document.createRange(); range.selectNodeContents(host);
  w.getSelection().addRange(range);
  let answer;
  Object.assign(w, { editing:{on:true,el:host,prompt:false}, cwin:w, cdoc:w.document,
    askText:()=>new Promise(resolve=>{answer=resolve;}), syncEdit:vi.fn() });
  w.document.execCommand = vi.fn(() => {
    expect(w.getSelection().toString()).toBe('Selected words');
    return true;
  });
  w.eval(source.slice(source.indexOf('async function linkPrompt() {'),source.indexOf("\n$('#rt').addEventListener('mousedown'")));
  const pending = w.linkPrompt();
  expect(w.editing.prompt).toBe(true);
  w.document.querySelector('input').focus(); w.getSelection().removeAllRanges();
  answer('https://example.com/test'); await pending;
  expect(w.document.execCommand).toHaveBeenCalledWith('createLink',false,'https://example.com/test');
  expect(w.syncEdit).toHaveBeenCalledTimes(1);
  expect(w.editing.prompt).toBe(false);
  const cancel = w.linkPrompt(); answer(null); await cancel;
  expect(w.syncEdit).toHaveBeenCalledTimes(1);
});
test('current page survives reload by stable id, stays site scoped and falls back when removed', () => {
  const w = browser();
  w.eval(source.slice(source.indexOf('function rememberedPageIndex('),source.indexOf('\nfunction openPage(index')));
  w.state={pages:[{id:'home'},{id:'about'}],cur:1};
  w.rememberCurrentPage();
  expect(w.rememberedPageIndex([{id:'about'},{id:'home'}])).toBe(0);
  expect(w.rememberedPageIndex(w.state.pages)).toBe(1);
  w.history.replaceState(null,'','/edit/site-two');
  expect(w.rememberedPageIndex(w.state.pages)).toBe(0);
  w.history.replaceState(null,'','/edit/site-one');
  expect(w.rememberedPageIndex([{id:'home'}])).toBe(0);
});
