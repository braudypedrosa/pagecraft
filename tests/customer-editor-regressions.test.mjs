import { afterEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { safeRichUrl } from '../app/src/core/safe-html.ts';
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
    askText:()=>new Promise(resolve=>{answer=resolve;}), syncEdit:vi.fn(), safeRichUrl, toast:vi.fn() });
  w.document.execCommand = vi.fn(() => true);
  w.eval(source.slice(source.indexOf('async function linkPrompt() {'),source.indexOf("\n$('#rt').addEventListener('mousedown'")));
  const pending = w.linkPrompt();
  expect(w.editing.prompt).toBe(true);
  w.document.querySelector('input').focus(); w.getSelection().removeAllRanges();
  answer('https://example.com/test'); await pending;
  expect(w.getSelection().toString()).toBe('Selected words');
  expect(w.document.execCommand).toHaveBeenCalledWith('createLink',false,'https://example.com/test');
  expect(w.syncEdit).toHaveBeenCalledTimes(1);
  expect(w.editing.prompt).toBe(false);

  for (const url of ['javascript:alert(1)', 'data:image/png;base64,AAAA', 'asset:hero', '//evil.example/path']) {
    const unsafe = w.linkPrompt(); answer(url); await unsafe;
    expect(w.document.execCommand).toHaveBeenCalledTimes(1);
    expect(w.syncEdit).toHaveBeenCalledTimes(1);
  }
  expect(w.toast).toHaveBeenCalledTimes(4);
  expect(w.toast).toHaveBeenLastCalledWith('Use a web, email, phone, page or anchor link.', {tone:'error'});

  for (const url of ['/about', '../contact', 'mailto:team@example.com', 'tel:+6400000000', 'http://example.com', 'https://example.com/ok']) {
    const allowed = w.linkPrompt(); answer(url); await allowed;
    expect(w.document.execCommand).toHaveBeenLastCalledWith('createLink', false, url);
  }
  expect(w.syncEdit).toHaveBeenCalledTimes(7);

  const collapsed = w.document.createRange(); collapsed.setStart(host.firstChild, 4); collapsed.collapse(true);
  w.getSelection().removeAllRanges(); w.getSelection().addRange(collapsed);
  const emptySelection = w.linkPrompt(); answer('about.html'); await emptySelection;
  expect(w.getSelection().isCollapsed).toBe(true);
  expect(w.document.execCommand).toHaveBeenLastCalledWith('createLink', false, 'about.html');
  expect(w.syncEdit).toHaveBeenCalledTimes(8);

  const cancel = w.linkPrompt(); answer(null); await cancel;
  expect(w.syncEdit).toHaveBeenCalledTimes(8);
});
function richBlockHarness(html, selector = '#editable') {
  const dom = new JSDOM(`<div id="editable" contenteditable>${html}</div>`, {runScripts:'outside-only'});
  windows.push(dom); const w = dom.window, host = w.document.querySelector('#editable');
  Object.assign(w, {editing:{el:host},cwin:w,cdoc:w.document});
  const start=source.indexOf('function formatRichBlock(tag) {'),end=source.indexOf("\n$('#rt').addEventListener('mousedown'",start);
  w.eval(source.slice(start,end));
  const range=w.document.createRange();range.selectNodeContents(w.document.querySelector(selector));w.getSelection().addRange(range);
  return {w,host};
}
test('paragraph formatting unwraps selected quote and list content into valid sibling paragraphs',()=>{
 const {w,host}=richBlockHarness('<blockquote><p><b>Lead</b></p><ol><li>One</li><li><i>Two</i></li></ol></blockquote>');
 expect(w.formatRichBlock('p')).toBe(true);
 expect(host.innerHTML).toBe('<p><b>Lead</b></p><p>One</p><p><i>Two</i></p>');
 expect(host.querySelector('p ol, p ul, blockquote')).toBeNull();expect(w.getSelection().toString()).toBe('LeadOneTwo');
});
test('paragraph formatting repairs existing invalid paragraph and list nesting',()=>{
 const {w,host}=richBlockHarness('<blockquote></blockquote>'),quote=host.querySelector('blockquote'),bad=w.document.createElement('p'),list=w.document.createElement('ol');
 bad.append('Before ');list.innerHTML='<li>One</li><li>Two</li>';bad.append(list,' After');quote.append(bad);
 const range=w.document.createRange();range.selectNodeContents(host);w.getSelection().removeAllRanges();w.getSelection().addRange(range);w.formatRichBlock('p');
 expect(host.innerHTML).toBe('<p>Before </p><p>One</p><p>Two</p><p> After</p>');expect(host.querySelector('p ol,p ul,blockquote')).toBeNull();
});
test.each([['h2','H2'],['h3','H3'],['blockquote','BLOCKQUOTE']])('%s formatting converts selected list items without nesting lists in blocks',(tag,nodeName)=>{
 const {w,host}=richBlockHarness('<ul><li>A <strong>bold</strong></li><li>B</li></ul><p>Tail</p>');w.formatRichBlock(tag);
 expect([...host.children].map(node=>node.nodeName)).toEqual([nodeName,nodeName,nodeName]);
 expect(host.querySelector(`${tag} ol,${tag} ul`)).toBeNull();expect(host.textContent).toBe('A boldBTail');
});
test('paragraph formatting preserves text and selection after sequential quote formatting',()=>{
 const text='QA quote retains café & courtyard <sample>.';
 const {w,host}=richBlockHarness('<p>QA quote retains café &amp; courtyard &lt;sample&gt;.</p>');
 expect(w.formatRichBlock('blockquote')).toBe(true);
 expect(host.innerHTML).toBe('<blockquote>QA quote retains café &amp; courtyard &lt;sample&gt;.</blockquote>');
 expect(w.getSelection().toString()).toBe(text);
 expect(w.formatRichBlock('p')).toBe(true);
 expect(host.innerHTML).toBe('<p>QA quote retains café &amp; courtyard &lt;sample&gt;.</p>');
 expect(w.getSelection().toString()).toBe(text);
});
test.each([['h2','H2'],['h3','H3']])('sequential quote then %s formatting preserves direct inline content',(tag,nodeName)=>{
 const {w,host}=richBlockHarness('<p>Lead <strong>bold</strong> tail</p>');
 w.formatRichBlock('blockquote');w.formatRichBlock(tag);
 expect(host.innerHTML).toBe(`<${tag}>Lead <strong>bold</strong> tail</${tag}>`);
 expect(host.firstElementChild.nodeName).toBe(nodeName);
 expect(w.getSelection().toString()).toBe('Lead bold tail');
});
test('partial selection splits each affected list and preserves unselected list items',()=>{
 const {w,host}=richBlockHarness('<ol><li>Keep A</li><li id="first">Change A</li><li>Keep B</li></ol><ul><li id="second">Change B</li><li>Keep C</li></ul>','#first');
 const range=w.document.createRange();range.setStartBefore(host.querySelector('#first'));range.setEndAfter(host.querySelector('#second'));w.getSelection().removeAllRanges();w.getSelection().addRange(range);w.formatRichBlock('h2');
 expect(host.innerHTML).toBe('<ol><li>Keep A</li></ol><h2>Change A</h2><h2>Keep B</h2><h2>Change B</h2><ul><li>Keep C</li></ul>');
 expect(host.querySelector('h2 ol,h2 ul')).toBeNull();
});
test('a list-item boundary selection never leaves marker or block nodes inside a list',()=>{
 const {w,host}=richBlockHarness('<ol><li>Keep</li><li id="change"><span style="color:red"><b>Change</b></span></li><li>After</li></ol>','#change'),item=host.querySelector('#change');
 const range=w.document.createRange();range.setStartBefore(item);range.setEndAfter(item);w.getSelection().removeAllRanges();w.getSelection().addRange(range);w.formatRichBlock('h3');
 expect(host.innerHTML).toBe('<ol><li>Keep</li></ol><h3><span style="color:red"><b>Change</b></span></h3><ol><li>After</li></ol>');
 expect(host.querySelector('ol > :not(li),ul > :not(li),h3 ol,h3 ul')).toBeNull();expect(w.getSelection().toString()).toBe('Change');
});
test('nested selected list items become valid sibling blocks',()=>{
 const {w,host}=richBlockHarness('<ul><li id="parent">Parent<ul><li>Child <i>detail</i></li></ul></li><li>Keep</li></ul>','#parent');w.formatRichBlock('h2');
 expect(host.innerHTML).toBe('<h2>Parent</h2><h2>Child <i>detail</i></h2><ul><li>Keep</li></ul>');expect(host.querySelector('h2 ul,h2 ol')).toBeNull();
});
test('collapsed root and empty-host carets create or convert one valid block',()=>{
 const first=richBlockHarness('<p>First</p><p>Second</p>'),range=first.w.document.createRange();range.setStart(first.host,1);range.collapse(true);first.w.getSelection().removeAllRanges();first.w.getSelection().addRange(range);first.w.formatRichBlock('h2');
 expect(first.host.innerHTML).toBe('<p>First</p><h2>Second</h2>');expect(first.w.getSelection().isCollapsed).toBe(true);expect(first.w.getSelection().anchorNode.parentElement.nodeName).toBe('H2');expect(first.w.getSelection().anchorOffset).toBe(0);
 const empty=richBlockHarness('');empty.w.formatRichBlock('p');expect(empty.host.innerHTML).toBe('<p><br></p>');expect(empty.w.getSelection().isCollapsed).toBe(true);
});
function inlineSyncHarness(node, html, prop = null) {
 const w=browser(),host=w.document.querySelector('#editable');host.innerHTML=html;
 Object.defineProperty(w.HTMLElement.prototype,'innerText',{configurable:true,get(){return this.textContent;},set(v){this.textContent=v;}});
 const calls=[],editing={on:true,id:node.id,el:host,kind:node.type==='text'?'rich':'text',prop,off:[],prompt:false,changed:false,label:'Change rich text text',value:null};
 const locate=()=>({node}),checkpoint=vi.fn(label=>calls.push(['checkpoint',label,structuredClone(node)]));
 const paintHistory=vi.fn(()=>calls.push(['history'])),save=vi.fn(()=>calls.push(['save'])),renderLayers=vi.fn(()=>calls.push(['layers']));
 const instSet=(n,key,value)=>{n.vals ||= {};n.vals[key]=value;};
 const start=source.indexOf('const EDIT_IN ='),end=source.indexOf('\nfunction exitEdit(',start);
 expect(start).toBeGreaterThan(-1);expect(end).toBeGreaterThan(start);
 const api=new Function('editing','locate','checkpoint','paintHistory','instSet','$','save','renderLayers',
   `${source.slice(start,end)}; return {inlineEditValue,syncEdit};`
 )(editing,locate,checkpoint,paintHistory,instSet,()=>null,save,renderLayers);
 editing.value=api.inlineEditValue(node,host);
 return {w,host,node,editing,calls,checkpoint,paintHistory,save,renderLayers,syncEdit:api.syncEdit};
}
test('inline edit checkpoints and saves only after the first real DOM mutation',()=>{
 const original='<p>Garden &#38; rooms</p>   ',node={id:'rich',type:'text',props:{html:original}};
 const h=inlineSyncHarness(node,original);
 expect(h.host.innerHTML.trim()).toBe('<p>Garden &amp; rooms</p>');
 expect(h.syncEdit()).toBe(false);
 expect(node.props.html).toBe(original);expect(h.calls).toEqual([]);

 h.host.querySelector('p').append('!');
 expect(h.syncEdit()).toBe(true);
 expect(h.calls.map(call=>call[0])).toEqual(['checkpoint','history','save','layers']);
 expect(h.calls[0][1]).toBe('Change rich text text');
 expect(h.calls[0][2].props.html).toBe(original,'Undo keeps the original stored bytes');
 expect(node.props.html).toBe('<p>Garden &amp; rooms!</p>');
 expect(h.syncEdit()).toBe(false);expect(h.checkpoint).toHaveBeenCalledTimes(1);expect(h.save).toHaveBeenCalledTimes(1);
});
test('viewing inherited component text does not materialize an own property',()=>{
 const node={id:'instance',type:'heading',use:'component',props:{text:'Definition'}};
 const h=inlineSyncHarness(node,'Inherited title','title');
 expect(h.syncEdit()).toBe(false);expect(node.vals).toBeUndefined();expect(h.calls).toEqual([]);
 h.host.textContent='Changed title';expect(h.syncEdit()).toBe(true);
 expect(h.calls[0][2].vals).toBeUndefined();expect(node.vals).toEqual({title:'Changed title'});
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
